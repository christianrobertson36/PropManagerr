import { initDatabase } from './initDb.js';
import 'dotenv/config';
import fs from 'fs/promises';
import fsSync from 'fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { query } from './db.js';
import { comparePassword, hashPassword, requireAdmin, requireAuth, signUser } from './auth.js';
import multer from 'multer';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

const uploadsRoot = process.env.UPLOADS_DIR || '/app/uploads';
const documentUploadDir = `${uploadsRoot}/documents`;
fsSync.mkdirSync(documentUploadDir, { recursive: true });
app.use('/uploads', express.static(uploadsRoot));

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, documentUploadDir);
  },
  filename: (_req, file, cb) => {
    const originalName = file.originalname || 'document';
    const dotIndex = originalName.lastIndexOf('.');
    const ext = dotIndex > -1 ? originalName.slice(dotIndex).toLowerCase() : '';
    const nameWithoutExt = dotIndex > -1 ? originalName.slice(0, dotIndex) : originalName;
    const safeBaseName =
      nameWithoutExt
        .replace(/[^a-zA-Z0-9-_ ]/g, '')
        .trim()
        .replace(/\s+/g, '-') || 'document';

    cb(null, `${safeBaseName}-${Date.now()}${ext}`);
  },
});

const upload = multer({ storage: uploadStorage });

const tenantFilter = (user, alias = '') =>
  user.role === 'admin'
    ? { sql: '', params: [] }
    : { sql: ` where ${alias}tenant_id = $1`, params: [user.tenant_id] };

async function resolveTenantAccountLink(user) {
  if (!user || user.role !== 'tenant' || user.tenant_id) return user;

  const { rows } = await query(
    'select id from tenants where lower(email)=lower($1) limit 1',
    [user.email]
  );

  const tenant = rows[0];
  if (!tenant) return user;

  await query('update app_users set tenant_id=$2 where id=$1', [user.id, tenant.id]);
  return { ...user, tenant_id: tenant.id };
}

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const { rows } = await query(
    'select id, name, email, role, tenant_id, password_hash from app_users where lower(email)=lower($1) and active=true',
    [email]
  );

  let user = rows[0];
  if (!user || !(await comparePassword(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid login' });
  }

  delete user.password_hash;
  user = await resolveTenantAccountLink(user);
  res.json({ token: signUser(user), user });
});

app.get('/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));

app.get('/admin/accounts', requireAuth, requireAdmin, async (_req, res) => {
  const { rows } = await query(
    `select u.id, u.name, u.email, u.role, u.tenant_id, u.active, row_to_json(t.*) as tenant
     from app_users u
     left join tenants t on t.id = u.tenant_id
     order by u.role, u.name`
  );
  res.json(rows);
});

app.post('/admin/accounts', requireAuth, requireAdmin, async (req, res) => {
  const {
    name,
    email,
    password,
    role = 'tenant',
    tenant_id = null,
    active = true,
  } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }

  if (!['admin', 'tenant'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or tenant' });
  }

  if (role === 'tenant' && !tenant_id) {
    return res.status(400).json({ error: 'Tenant accounts must be linked to a tenant' });
  }

  const passwordHash = await hashPassword(password);
  const accountTenantId = role === 'tenant' ? tenant_id : null;

  try {
    const { rows } = await query(
      `insert into app_users(name, email, password_hash, role, tenant_id, active)
       values ($1, $2, $3, $4, $5, $6)
       returning id, name, email, role, tenant_id, active`,
      [name, email, passwordHash, role, accountTenantId, active]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    throw err;
  }
});

app.patch('/admin/accounts/:id', requireAuth, requireAdmin, async (req, res) => {
  const allowedFields = ['name', 'email', 'role', 'tenant_id', 'active'];
  const updates = [];
  const values = [req.params.id];

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      let value = req.body[field];

      if (field === 'role' && !['admin', 'tenant'].includes(value)) {
        return res.status(400).json({ error: 'Role must be admin or tenant' });
      }

      if (field === 'tenant_id' && req.body.role === 'admin') {
        value = null;
      }

      values.push(value);
      updates.push(`${field}=$${values.length}`);
    }
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'password') && req.body.password) {
    values.push(await hashPassword(req.body.password));
    updates.push(`password_hash=$${values.length}`);
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'No fields supplied to update' });
  }

  try {
    const { rows } = await query(
      `update app_users set ${updates.join(', ')} where id=$1 returning id, name, email, role, tenant_id, active`,
      values
    );
    sendOneOr404(res, rows, 'Account');
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    throw err;
  }
});

app.get('/dashboard', requireAuth, async (req, res) => {
  const currentUser = await resolveTenantAccountLink(req.user);
  const params = currentUser.role === 'admin' ? [] : [currentUser.tenant_id];
  const propertyWhere = currentUser.role === 'admin' ? '' : ' where id in (select property_id from tenants where id=$1)';
  const tenantWhere = tenantFilter(currentUser);
  const rentWhere = tenantFilter(currentUser);
  const maintWhere =
    currentUser.role === 'admin'
      ? ''
      : ' where tenant_id=$1 or property_id in (select property_id from tenants where id=$1)';
  const docWhere =
    currentUser.role === 'admin'
      ? ''
      : ' where d.tenant_id=$1 or d.property_id in (select property_id from tenants where id=$1) or (d.tenant_id is null and d.property_id is null)';
  const expenseWhere = currentUser.role === 'admin' ? '' : ' where false';

  const [properties, tenants, rentPayments, maintenanceTickets, documents, expenses] = await Promise.all([
    query(`select * from properties${propertyWhere} order by address`, params),
    query(
      `select t.*, row_to_json(p.*) as property
       from tenants t
       left join properties p on p.id=t.property_id${tenantWhere.sql}
       order by t.name`,
      tenantWhere.params
    ),
    query(
      `select r.*, row_to_json(t.*) as tenant, row_to_json(p.*) as property
       from rent_payments r
       left join tenants t on t.id=r.tenant_id
       left join properties p on p.id=r.property_id${rentWhere.sql}
       order by due_date desc`,
      rentWhere.params
    ),
    query(
      `select m.*, row_to_json(p.*) as property, row_to_json(t.*) as tenant
       from maintenance_tickets m
       left join properties p on p.id=m.property_id
       left join tenants t on t.id=m.tenant_id${maintWhere}
       order by m.created_at desc`,
      params
    ),
    query(
      `select d.*, row_to_json(p.*) as property, row_to_json(t.*) as tenant
       from documents d
       left join properties p on p.id=d.property_id
       left join tenants t on t.id=d.tenant_id${docWhere}
       order by d.expiry_date nulls last`,
      params
    ),
    query(
      `select e.*, row_to_json(p.*) as property
       from expenses e
       left join properties p on p.id=e.property_id${expenseWhere}
       order by date desc`,
      params
    ),
  ]);

  res.json({
    properties: properties.rows,
    tenants: tenants.rows,
    rentPayments: rentPayments.rows,
    maintenanceTickets: maintenanceTickets.rows,
    documents: documents.rows,
    expenses: expenses.rows,
  });
});

app.get('/compliance/updates', requireAuth, (_req, res) => {
  res.json([
    {
      id: 'renters-rights-act-roadmap',
      title: "Renters' Rights Act 2025 implementation roadmap",
      summary:
        'Official GOV.UK roadmap for private rented sector reforms. Review the roadmap before making tenancy or process changes.',
      source: 'GOV.UK',
      url: 'https://www.gov.uk/government/publications/renters-rights-act-2025-implementation-roadmap/implementing-the-renters-rights-act-2025-our-roadmap-for-reforming-the-private-rented-sector',
      effective_date: '2026-05-01',
      last_checked: '2026-06-05',
      severity: 'important',
    },
    {
      id: 'right-to-rent-checks',
      title: 'Right to rent checks',
      summary:
        'Official GOV.UK service for landlords and agents to check a tenant right to rent using a share code.',
      source: 'GOV.UK',
      url: 'https://www.gov.uk/view-right-to-rent',
      effective_date: null,
      last_checked: '2026-06-05',
      severity: 'required',
    },
    {
      id: 'landlord-safety-responsibilities',
      title: 'Landlord safety responsibilities',
      summary:
        'Official GOV.UK guidance covering key landlord safety responsibilities including gas safety and property safety duties.',
      source: 'GOV.UK',
      url: 'https://www.gov.uk/private-renting/your-landlords-safety-responsibilities',
      effective_date: null,
      last_checked: '2026-06-05',
      severity: 'required',
    },
    {
      id: 'smoke-carbon-monoxide-alarms',
      title: 'Smoke and carbon monoxide alarm requirements',
      summary:
        'Official GOV.UK guidance on smoke and carbon monoxide alarm requirements for landlords.',
      source: 'GOV.UK',
      url: 'https://www.gov.uk/government/publications/smoke-and-carbon-monoxide-alarms-explanatory-booklet-for-landlords',
      effective_date: null,
      last_checked: '2026-06-05',
      severity: 'required',
    },
  ]);
});

app.post('/maintenance', requireAuth, async (req, res) => {
  const { title, description, property_id, urgency = 'medium' } = req.body || {};

  if (!title || !description || !property_id) {
    return res.status(400).json({ error: 'Title, description and property are required' });
  }

  if (req.user.role !== 'admin') {
    const allowed = await query('select 1 from tenants where id=$1 and property_id=$2', [
      req.user.tenant_id,
      property_id,
    ]);

    if (!allowed.rows[0]) {
      return res.status(403).json({ error: 'Cannot create ticket for another property' });
    }
  }

  const tenantId = req.user.role === 'tenant' ? req.user.tenant_id : req.body.tenant_id || null;
  const { rows } = await query(
    'insert into maintenance_tickets(title, description, property_id, tenant_id, urgency, status) values ($1,$2,$3,$4,$5,$6) returning *',
    [title, description, property_id, tenantId, urgency, 'open']
  );

  res.status(201).json(rows[0]);
});

const sendOneOr404 = (res, rows, name = 'Record') => {
  if (!rows[0]) return res.status(404).json({ error: `${name} not found` });
  return res.json(rows[0]);
};

const adminCrud = (path, table, fields, name) => {
  app.post(path, requireAuth, requireAdmin, async (req, res) => {
    const values = fields.map((field) => req.body[field] ?? null);
    const columns = fields.join(', ');
    const params = fields.map((_, index) => `$${index + 1}`).join(', ');
    const { rows } = await query(
      `insert into ${table} (${columns}) values (${params}) returning *`,
      values
    );
    res.status(201).json(rows[0]);
  });

  app.patch(`${path}/:id`, requireAuth, requireAdmin, async (req, res) => {
    const updates = fields.filter((field) => Object.prototype.hasOwnProperty.call(req.body, field));

    if (!updates.length) {
      return res.status(400).json({ error: 'No fields supplied to update' });
    }

    const setSql = updates.map((field, index) => `${field}=$${index + 2}`).join(', ');
    const values = updates.map((field) => req.body[field]);
    const { rows } = await query(
      `update ${table} set ${setSql} where id=$1 returning *`,
      [req.params.id, ...values]
    );

    sendOneOr404(res, rows, name);
  });

  app.delete(`${path}/:id`, requireAuth, requireAdmin, async (req, res) => {
    const { rows } = await query(`delete from ${table} where id=$1 returning *`, [req.params.id]);
    sendOneOr404(res, rows, name);
  });
};

adminCrud(
  '/properties',
  'properties',
  ['address', 'city', 'postcode', 'status', 'monthly_rent', 'bedrooms', 'property_type'],
  'Property'
);

adminCrud(
  '/tenants',
  'tenants',
  ['property_id', 'name', 'email', 'phone', 'lease_start', 'lease_end', 'payment_status'],
  'Tenant'
);

adminCrud(
  '/rent-payments',
  'rent_payments',
  ['tenant_id', 'property_id', 'due_date', 'amount', 'status', 'paid_date', 'payment_method', 'notes'],
  'Rent payment'
);

adminCrud(
  '/maintenance-admin',
  'maintenance_tickets',
  ['property_id', 'tenant_id', 'title', 'description', 'urgency', 'status', 'contractor', 'cost', 'notes'],
  'Maintenance ticket'
);

async function normaliseDocumentPayload(body) {
  const tenantId = body.tenant_id || null;
  let propertyId = body.property_id || null;

  if (tenantId && !propertyId) {
    const { rows } = await query('select property_id from tenants where id=$1', [tenantId]);
    propertyId = rows[0]?.property_id || null;
  }

  return {
    property_id: propertyId,
    tenant_id: tenantId,
    name: body.name ?? null,
    doc_type: body.doc_type ?? null,
    expiry_date: body.expiry_date || null,
    file_url: body.file_url || null,
  };
}

app.post('/documents', requireAuth, requireAdmin, async (req, res) => {
  const payload = await normaliseDocumentPayload(req.body || {});
  if (!payload.name) {
    return res.status(400).json({ error: 'Document name is required' });
  }

  const { rows } = await query(
    `insert into documents (property_id, tenant_id, name, doc_type, expiry_date, file_url)
     values ($1,$2,$3,$4,$5,$6)
     returning *`,
    [payload.property_id, payload.tenant_id, payload.name, payload.doc_type, payload.expiry_date, payload.file_url]
  );
  res.status(201).json(rows[0]);
});

app.patch('/documents/:id', requireAuth, requireAdmin, async (req, res) => {
  const payload = await normaliseDocumentPayload(req.body || {});
  const fields = ['property_id', 'tenant_id', 'name', 'doc_type', 'expiry_date', 'file_url'];
  const updates = fields.filter((field) => Object.prototype.hasOwnProperty.call(req.body, field));

  if (payload.tenant_id && !req.body.property_id && !updates.includes('property_id')) {
    updates.push('property_id');
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'No fields supplied to update' });
  }

  const values = updates.map((field) => payload[field]);
  const setSql = updates.map((field, index) => `${field}=$${index + 2}`).join(', ');
  const { rows } = await query(
    `update documents set ${setSql} where id=$1 returning *`,
    [req.params.id, ...values]
  );
  sendOneOr404(res, rows, 'Document');
});

app.delete('/documents/:id', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await query('delete from documents where id=$1 returning *', [req.params.id]);
  const deleted = rows[0];

  if (!deleted) {
    return res.status(404).json({ error: 'Document not found' });
  }

  if (deleted.file_url && deleted.file_url.startsWith('/uploads/documents/')) {
    const filename = deleted.file_url.replace('/uploads/documents/', '');
    if (filename && !filename.includes('/') && !filename.includes('..')) {
      await fs.unlink(`${documentUploadDir}/${filename}`).catch(() => undefined);
    }
  }

  return res.json(deleted);
});

function uploadDocumentFile(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('Document upload failed', err);
      return res.status(500).json({ error: 'Document upload failed. Check the uploads volume and folder permissions.' });
    }
    next();
  });
}

app.post('/documents/upload', requireAuth, requireAdmin, uploadDocumentFile, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  res.json({
    file_url: `/uploads/documents/${req.file.filename}`,
    original_name: req.file.originalname,
  });
});

adminCrud(
  '/expenses',
  'expenses',
  ['property_id', 'date', 'category', 'description', 'amount', 'supplier', 'receipt_url', 'notes'],
  'Expense'
);


async function applyRuntimeMigrations() {
  await query('alter table documents alter column property_id drop not null');
  await query(`
    update app_users u
    set tenant_id = t.id
    from tenants t
    where u.role = 'tenant'
      and u.tenant_id is null
      and lower(u.email) = lower(t.email)
  `);
}

const port = Number(process.env.PORT || 3000);
await initDatabase();
await applyRuntimeMigrations();
app.listen(port, () => console.log(`PropManager API listening on ${port}`));
