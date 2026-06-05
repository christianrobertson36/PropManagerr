import { initDatabase } from './initDb.js';
import 'dotenv/config';
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
app.use('/uploads', express.static('/app/uploads'));

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, '/app/uploads/documents');
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

const upload = multer({
  storage: uploadStorage,
});

const tenantFilter = (user, alias = '') => user.role === 'admin' ? { sql: '', params: [] } : { sql: ` where ${alias}tenant_id = $1`, params: [user.tenant_id] };

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const { rows } = await query('select id, name, email, role, tenant_id, password_hash from app_users where lower(email)=lower($1) and active=true', [email]);
  const user = rows[0];
  if (!user || !(await comparePassword(password, user.password_hash))) return res.status(401).json({ error: 'Invalid login' });
  delete user.password_hash;
  res.json({ token: signUser(user), user });
});

app.get('/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));

app.get('/admin/accounts', requireAuth, requireAdmin, async (_req, res) => {
  const { rows } = await query(
    `select u.id,
            u.name,
            u.email,
            u.role,
            u.tenant_id,
            u.active,
            row_to_json(t.*) as tenant
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
  const params = req.user.role === 'admin' ? [] : [req.user.tenant_id];
  const propertyWhere = req.user.role === 'admin' ? '' : ' where id in (select property_id from tenants where id=$1)';
  const tenantWhere = tenantFilter(req.user);
  const rentWhere = tenantFilter(req.user);
  const maintWhere = req.user.role === 'admin' ? '' : ' where tenant_id=$1 or property_id in (select property_id from tenants where id=$1)';
  const docWhere = req.user.role === 'admin' ? '' : ' where tenant_id=$1 or property_id in (select property_id from tenants where id=$1)';
  const expenseWhere = req.user.role === 'admin' ? '' : ' where false';
  const [properties, tenants, rentPayments, maintenanceTickets, documents, expenses] = await Promise.all([
    query(`select * from properties${propertyWhere} order by address`, params),
    query(`select t.*, row_to_json(p.*) as property from tenants t left join properties p on p.id=t.property_id${tenantWhere.sql} order by t.name`, tenantWhere.params),
    query(`select r.*, row_to_json(t.*) as tenant, row_to_json(p.*) as property from rent_payments r left join tenants t on t.id=r.tenant_id left join properties p on p.id=r.property_id${rentWhere.sql} order by due_date desc`, rentWhere.params),
    query(`select m.*, row_to_json(p.*) as property, row_to_json(t.*) as tenant from maintenance_tickets m left join properties p on p.id=m.property_id left join tenants t on t.id=m.tenant_id${maintWhere} order by m.created_at desc`, params),
    query(`select d.*, row_to_json(p.*) as property, row_to_json(t.*) as tenant from documents d left join properties p on p.id=d.property_id left join tenants t on t.id=d.tenant_id${docWhere} order by d.expiry_date nulls last`, params),
    query(`select e.*, row_to_json(p.*) as property from expenses e left join properties p on p.id=e.property_id${expenseWhere} order by date desc`, params),
  ]);
  res.json({ properties: properties.rows, tenants: tenants.rows, rentPayments: rentPayments.rows, maintenanceTickets: maintenanceTickets.rows, documents: documents.rows, expenses: expenses.rows });
});

app.post('/maintenance', requireAuth, async (req, res) => {
  const { title, description, property_id, urgency = 'medium' } = req.body || {};
  if (!title || !description || !property_id) return res.status(400).json({ error: 'Title, description and property are required' });
  if (req.user.role !== 'admin') {
    const allowed = await query('select 1 from tenants where id=$1 and property_id=$2', [req.user.tenant_id, property_id]);
    if (!allowed.rows[0]) return res.status(403).json({ error: 'Cannot create ticket for another property' });
  }
  const tenantId = req.user.role === 'tenant' ? req.user.tenant_id : req.body.tenant_id || null;
  const { rows } = await query('insert into maintenance_tickets(title, description, property_id, tenant_id, urgency, status) values ($1,$2,$3,$4,$5,$6) returning *', [title, description, property_id, tenantId, urgency, 'open']);
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
    const updates = fields.filter((field) =>
      Object.prototype.hasOwnProperty.call(req.body, field)
    );

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
    const { rows } = await query(
      `delete from ${table} where id=$1 returning *`,
      [req.params.id]
    );

    sendOneOr404(res, rows, name);
  });
};

adminCrud('/properties', 'properties', [
  'address',
  'city',
  'postcode',
  'status',
  'monthly_rent',
  'bedrooms',
  'property_type'
], 'Property');

adminCrud('/tenants', 'tenants', [
  'property_id',
  'name',
  'email',
  'phone',
  'lease_start',
  'lease_end',
  'payment_status'
], 'Tenant');

adminCrud('/rent-payments', 'rent_payments', [
  'tenant_id',
  'property_id',
  'due_date',
  'amount',
  'status',
  'paid_date',
  'payment_method',
  'notes'
], 'Rent payment');

adminCrud('/maintenance-admin', 'maintenance_tickets', [
  'property_id',
  'tenant_id',
  'title',
  'description',
  'urgency',
  'status',
  'contractor',
  'cost',
  'notes'
], 'Maintenance ticket');

adminCrud('/documents', 'documents', [
  'property_id',
  'tenant_id',
  'name',
  'doc_type',
  'expiry_date',
  'file_url'
], 'Document');

adminCrud('/documents', 'documents', [
  'property_id',
  'tenant_id',
  'name',
  'doc_type',
  'expiry_date',
  'file_url'
], 'Document');

app.post(
  '/documents/upload',
  requireAuth,
  requireAdmin,
  upload.single('file'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    res.json({
      file_url: `/uploads/documents/${req.file.filename}`,
      original_name: req.file.originalname,
    });
  }
);

adminCrud('/expenses', 'expenses', [
  'property_id',
  'date',
  'category',
  'description',
  'amount',
  'supplier',
  'receipt_url',
  'notes'
], 'Expense');

const port = Number(process.env.PORT || 3000);

await initDatabase();

app.listen(port, () => console.log(`PropManager API listening on ${port}`));
