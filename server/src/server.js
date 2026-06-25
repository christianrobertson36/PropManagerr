import { initDatabase } from './initDb.js';
import 'dotenv/config';
import fs from 'fs/promises';
import fsSync from 'fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import multer from 'multer';
import crypto from 'crypto';
import { query } from './db.js';
import { comparePassword, hashPassword, requireAdmin, requireAuth, signUser } from './auth.js';

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
  destination: (_req, _file, cb) => cb(null, documentUploadDir),
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

const sendOneOr404 = (res, rows, name = 'Record') => {
  if (!rows[0]) return res.status(404).json({ error: `${name} not found` });
  return res.json(rows[0]);
};

async function resolveTenantAccountLink(user) {
  if (!user || user.role !== 'tenant' || user.tenant_id) return user;

  const { rows } = await query('select id from tenants where lower(email)=lower($1) and deleted_at is null limit 1', [user.email]);
  const tenant = rows[0];
  if (!tenant) return user;

  await query('update app_users set tenant_id=$2 where id=$1', [user.id, tenant.id]);
  return { ...user, tenant_id: tenant.id };
}

function uploadDocumentFile(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('Document upload failed', err);
      return res.status(500).json({
        error: 'Document upload failed. Check the uploads volume and folder permissions.',
      });
    }
    next();
  });
}


const makeId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const softDeleteTables = new Set(['properties', 'tenants', 'rent_payments', 'maintenance_tickets', 'documents', 'expenses']);

function activeWhere(alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return `${prefix}deleted_at is null`;
}

const adminCrud = (path, table, fields, name) => {
  app.get(path, requireAuth, requireAdmin, async (_req, res) => {
    const where = softDeleteTables.has(table) ? ' where deleted_at is null' : '';
    const { rows } = await query(`select * from ${table}${where} order by created_at desc`);
    res.json(rows);
  });
  app.post(path, requireAuth, requireAdmin, async (req, res) => {
    const values = fields.map((field) => req.body[field] ?? null);
    const columns = fields.join(', ');
    const params = fields.map((_, index) => `$${index + 1}`).join(', ');
    const { rows } = await query(`insert into ${table} (${columns}) values (${params}) returning *`, values);
    res.status(201).json(rows[0]);
  });

  app.patch(`${path}/:id`, requireAuth, requireAdmin, async (req, res) => {
    const updates = fields.filter((field) => Object.prototype.hasOwnProperty.call(req.body, field));
    if (!updates.length) return res.status(400).json({ error: 'No fields supplied to update' });

    const setSql = updates.map((field, index) => `${field}=$${index + 2}`).join(', ');
    const values = updates.map((field) => req.body[field]);
    const activeFilter = softDeleteTables.has(table) ? ' and deleted_at is null' : '';
    const { rows } = await query(`update ${table} set ${setSql} where id=$1${activeFilter} returning *`, [req.params.id, ...values]);
    sendOneOr404(res, rows, name);
  });

  app.delete(`${path}/:id`, requireAuth, requireAdmin, async (req, res) => {
    if (softDeleteTables.has(table)) {
      const { rows } = await query(`update ${table} set deleted_at=now() where id=$1 and deleted_at is null returning *`, [req.params.id]);
      return sendOneOr404(res, rows, name);
    }

    const { rows } = await query(`delete from ${table} where id=$1 returning *`, [req.params.id]);
    sendOneOr404(res, rows, name);
  });
};

app.get('/admin/export', requireAuth, requireAdmin, async (_req, res) => {
  const exportQueries = {
    properties: 'select * from properties where deleted_at is null order by created_at desc',
    tenants: 'select * from tenants where deleted_at is null order by created_at desc',
    rent_payments: 'select * from rent_payments where deleted_at is null order by created_at desc',
    maintenance_tickets: 'select * from maintenance_tickets where deleted_at is null order by created_at desc',
    documents: 'select * from documents where deleted_at is null order by created_at desc',
    expenses: 'select * from expenses where deleted_at is null order by created_at desc',
    tenancy_agreements: 'select * from tenancy_agreements order by created_at desc',
  };

  const tables = {};
  for (const [name, sql] of Object.entries(exportQueries)) {
    const { rows } = await query(sql);
    tables[name] = rows;
  }

  res.json({
    app: 'PropManagerr',
    export_type: 'admin_backup_export',
    exported_at: new Date().toISOString(),
    tables,
  });
});

app.get('/trash', requireAuth, requireAdmin, async (_req, res) => {
  const tables = ['properties', 'tenants', 'rent_payments', 'maintenance_tickets', 'documents', 'expenses'];
  const records = [];

  for (const table of tables) {
    const { rows } = await query(`select * from ${table} where deleted_at is not null order by deleted_at desc limit 50`);
    for (const row of rows) {
      const name =
        row.address ||
        row.name ||
        row.title ||
        row.description ||
        row.category ||
        row.email ||
        row.id;

      records.push({
        table,
        id: row.id,
        name,
        deleted_at: row.deleted_at,
        row,
      });
    }
  }

  records.sort((a, b) => new Date(b.deleted_at || 0).getTime() - new Date(a.deleted_at || 0).getTime());
  res.json(records);
});

app.post('/trash/restore', requireAuth, requireAdmin, async (req, res) => {
  const table = String(req.body?.table || '').trim();
  const id = String(req.body?.id || '').trim();

  if (!softDeleteTables.has(table)) return res.status(400).json({ error: 'Unsupported restore table' });
  if (!id) return res.status(400).json({ error: 'Restore id is required' });

  const { rows } = await query(`update ${table} set deleted_at=null where id=$1 returning *`, [id]);
  sendOneOr404(res, rows, 'Deleted record');
});



function normaliseLicenseKey(value) {
  return String(value || '').trim().toUpperCase();
}

function generateLicenseKey() {
  const parts = Array.from({ length: 4 }, () => crypto.randomBytes(2).toString('hex').toUpperCase());
  return `PMLOCAL-${parts.join('-')}`;
}

function generateActivationToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function ensureLicenseTables() {
  await query(`
    create table if not exists license_keys (
      id text primary key,
      license_key text unique not null,
      customer_email text,
      customer_name text,
      status text not null default 'active',
      max_activations integer not null default 1,
      expires_at timestamptz,
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await query(`
    create table if not exists license_activations (
      id text primary key,
      license_key_id text not null references license_keys(id) on delete cascade,
      device_id text not null,
      device_name text,
      app_version text,
      activation_token text unique not null,
      activated_at timestamptz not null default now(),
      last_checked_at timestamptz not null default now(),
      deactivated_at timestamptz,
      unique (license_key_id, device_id)
    )
  `);
}

function publicLicenseRow(row) {
  return {
    license_key: row.license_key,
    status: row.status,
    customer_email: row.customer_email,
    customer_name: row.customer_name,
    max_activations: row.max_activations,
    expires_at: row.expires_at,
  };
}

async function findValidLicense(licenseKey) {
  const key = normaliseLicenseKey(licenseKey);
  if (!key) return { error: 'Licence key is required' };

  const { rows } = await query('select * from license_keys where license_key=$1 limit 1', [key]);
  const license = rows[0];

  if (!license) return { error: 'Licence key was not found' };
  if (license.status !== 'active') return { error: 'Licence key is not active' };
  if (license.expires_at && new Date(license.expires_at).getTime() < Date.now()) {
    return { error: 'Licence key has expired' };
  }

  return { license };
}

ensureLicenseTables().catch(error => {
  console.error('Failed to initialise licence tables', error);
});

app.get('/admin/licenses', requireAuth, requireAdmin, async (_req, res) => {
  const { rows } = await query(`
    select
      lk.*,
      count(la.id) filter (where la.deactivated_at is null) as active_activations
    from license_keys lk
    left join license_activations la on la.license_key_id = lk.id
    group by lk.id
    order by lk.created_at desc
  `);

  res.json(rows);
});

app.post('/admin/licenses', requireAuth, requireAdmin, async (req, res) => {
  const {
    license_key,
    customer_email = null,
    customer_name = null,
    max_activations = 1,
    expires_at = null,
    notes = null,
  } = req.body || {};

  const key = normaliseLicenseKey(license_key || generateLicenseKey());
  const maxActivations = Math.max(1, Number(max_activations || 1));

  const { rows } = await query(
    `insert into license_keys
      (id, license_key, customer_email, customer_name, max_activations, expires_at, notes)
     values ($1,$2,$3,$4,$5,$6,$7)
     returning *`,
    [crypto.randomUUID(), key, customer_email, customer_name, maxActivations, expires_at || null, notes]
  );

  res.status(201).json(rows[0]);
});

app.patch('/admin/licenses/:id', requireAuth, requireAdmin, async (req, res) => {
  const { status, customer_email, customer_name, max_activations, expires_at, notes } = req.body || {};
  const fields = [];
  const values = [];

  for (const [field, value] of Object.entries({ status, customer_email, customer_name, max_activations, expires_at, notes })) {
    if (value !== undefined) {
      values.push(field === 'max_activations' ? Math.max(1, Number(value || 1)) : value);
      fields.push(`${field}=${values.length + 1}`);
    }
  }

  if (fields.length === 0) return res.status(400).json({ error: 'No changes supplied' });

  const { rows } = await query(
    `update license_keys set ${fields.join(', ')}, updated_at=now() where id=$1 returning *`,
    [req.params.id, ...values]
  );

  if (!rows[0]) return res.status(404).json({ error: 'Licence not found' });
  res.json(rows[0]);
});

app.post('/license/activate', async (req, res) => {
  const { license_key, device_id, device_name = null, app_version = null } = req.body || {};
  const deviceId = String(device_id || '').trim();

  if (!deviceId) return res.status(400).json({ ok: false, error: 'Device ID is required' });

  const result = await findValidLicense(license_key);
  if (result.error) return res.status(400).json({ ok: false, error: result.error });

  const license = result.license;

  const existing = await query(
    `select * from license_activations
     where license_key_id=$1 and device_id=$2 and deactivated_at is null
     limit 1`,
    [license.id, deviceId]
  );

  if (existing.rows[0]) {
    const activationToken = generateActivationToken();
    const { rows } = await query(
      `update license_activations
       set activation_token=$1, device_name=$2, app_version=$3, last_checked_at=now()
       where id=$4
       returning *`,
      [activationToken, device_name, app_version, existing.rows[0].id]
    );

    return res.json({
      ok: true,
      activation_token: rows[0].activation_token,
      license: publicLicenseRow(license),
    });
  }

  const activeCount = await query(
    'select count(*)::int as count from license_activations where license_key_id=$1 and deactivated_at is null',
    [license.id]
  );

  if (activeCount.rows[0].count >= Number(license.max_activations || 1)) {
    return res.status(403).json({ ok: false, error: 'Activation limit reached for this licence' });
  }

  const activationToken = generateActivationToken();
  const { rows } = await query(
    `insert into license_activations
      (id, license_key_id, device_id, device_name, app_version, activation_token)
     values ($1,$2,$3,$4,$5,$6)
     returning *`,
    [crypto.randomUUID(), license.id, deviceId, device_name, app_version, activationToken]
  );

  res.status(201).json({
    ok: true,
    activation_token: rows[0].activation_token,
    license: publicLicenseRow(license),
  });
});

app.post('/license/check', async (req, res) => {
  const { license_key, device_id, activation_token, app_version = null } = req.body || {};
  const key = normaliseLicenseKey(license_key);
  const deviceId = String(device_id || '').trim();
  const token = String(activation_token || '').trim();

  if (!key || !deviceId || !token) {
    return res.status(400).json({ ok: false, error: 'Licence key, device ID and activation token are required' });
  }

  const { rows } = await query(
    `select lk.*, la.id as activation_id, la.deactivated_at
     from license_keys lk
     join license_activations la on la.license_key_id = lk.id
     where lk.license_key=$1 and la.device_id=$2 and la.activation_token=$3
     limit 1`,
    [key, deviceId, token]
  );

  const row = rows[0];

  if (!row) return res.status(401).json({ ok: false, error: 'Activation not found' });
  if (row.deactivated_at) return res.status(403).json({ ok: false, error: 'Activation has been deactivated' });
  if (row.status !== 'active') return res.status(403).json({ ok: false, error: 'Licence key is not active' });
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return res.status(403).json({ ok: false, error: 'Licence key has expired' });
  }

  await query(
    'update license_activations set app_version=$1, last_checked_at=now() where id=$2',
    [app_version, row.activation_id]
  );

  res.json({
    ok: true,
    license: publicLicenseRow(row),
  });
});


async function ensureLoginAuditTable() {
  await query(`
    create table if not exists login_audit (
      id text primary key,
      email text not null,
      user_id text,
      role text,
      tenant_id text,
      success boolean not null default false,
      failure_reason text,
      ip_address text,
      user_agent text,
      created_at timestamptz not null default now()
    )
  `);

  await query('create index if not exists idx_login_audit_created_at on login_audit(created_at desc)');
  await query('create index if not exists idx_login_audit_email on login_audit(lower(email))');
}

ensureLoginAuditTable().catch(error => {
  console.error('Failed to initialise login audit table', error);
});

async function recordLoginAudit(req, details) {
  try {
    await query(
      `insert into login_audit
        (id, email, user_id, role, tenant_id, success, failure_reason, ip_address, user_agent)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        crypto.randomUUID(),
        String(details.email || '').trim(),
        details.user_id || null,
        details.role || null,
        details.tenant_id || null,
        Boolean(details.success),
        details.failure_reason || null,
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null,
        req.headers['user-agent'] || null,
      ]
    );
  } catch (error) {
    console.error('Failed to record login audit', error);
  }
}

app.get('/health', (_req, res) => res.json({ ok: true, app: 'PropManagerr API', version: 'v78' }));

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const loginEmail = String(email || '').trim();

  if (!loginEmail || !password) {
    await recordLoginAudit(req, {
      email: loginEmail || 'missing-email',
      success: false,
      failure_reason: 'Email and password required',
    });
    return res.status(400).json({ error: 'Email and password required' });
  }

  const { rows } = await query(
    'select id, name, email, role, tenant_id, password_hash from app_users where lower(email)=lower($1) and active=true',
    [loginEmail]
  );

  let user = rows[0];
  if (!user || !(await comparePassword(password, user.password_hash))) {
    await recordLoginAudit(req, {
      email: loginEmail,
      user_id: user?.id || null,
      role: user?.role || null,
      tenant_id: user?.tenant_id || null,
      success: false,
      failure_reason: 'Invalid login',
    });
    return res.status(401).json({ error: 'Invalid login' });
  }

  delete user.password_hash;
  user = await resolveTenantAccountLink(user);

  await recordLoginAudit(req, {
    email: user.email,
    user_id: user.id,
    role: user.role,
    tenant_id: user.tenant_id || null,
    success: true,
  });

  res.json({ token: signUser(user), user });
});

app.get('/auth/me', requireAuth, async (req, res) => {
  const user = await resolveTenantAccountLink(req.user);
  res.json({ user });
});

app.post('/auth/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }
  if (String(new_password).length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const { rows } = await query(
    'select id, password_hash from app_users where id=$1 and active=true',
    [req.user.id]
  );
  const account = rows[0];
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const ok = await comparePassword(current_password, account.password_hash);
  if (!ok) return res.status(403).json({ error: 'Current password is incorrect' });

  await query('update app_users set password_hash=$2 where id=$1', [account.id, await hashPassword(new_password)]);
  res.json({ ok: true });
});

app.get('/admin/login-audit', requireAuth, requireAdmin, async (_req, res) => {
  try {
    await ensureLoginAuditTable();

    const { rows } = await query(`
      select
        id,
        email,
        user_id,
        role,
        tenant_id,
        null as tenant_name,
        success,
        failure_reason,
        ip_address,
        user_agent,
        created_at
      from login_audit
      order by created_at desc
      limit 100
    `);

    res.json(rows);
  } catch (error) {
    console.error('Failed to load login audit', error);
    res.status(500).json({ error: 'Could not load login activity' });
  }
});

app.get('/admin/accounts', requireAuth, requireAdmin, async (_req, res) => {
  const { rows } = await query(`
    select u.id, u.name, u.email, u.role, u.tenant_id, u.active, row_to_json(t.*) as tenant
    from app_users u
    left join tenants t on t.id = u.tenant_id
    order by u.role, u.name
  `);
  res.json(rows);
});

app.post('/admin/accounts', requireAuth, requireAdmin, async (req, res) => {
  const { name, email, password, role = 'tenant', tenant_id = null, active = true } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (!['admin', 'tenant'].includes(role)) return res.status(400).json({ error: 'Role must be admin or tenant' });
  if (role === 'tenant' && !tenant_id) return res.status(400).json({ error: 'Tenant accounts must be linked to a tenant' });

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
    if (err?.code === '23505') return res.status(409).json({ error: 'An account with this email already exists' });
    throw err;
  }
});

app.post('/admin/tenants/:id/portal-account', requireAuth, requireAdmin, async (req, res) => {
  const { rows: tenantRows } = await query('select * from tenants where id=$1 and deleted_at is null', [req.params.id]);
  const tenant = tenantRows[0];
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (!tenant.email) return res.status(400).json({ error: 'Tenant email is required before creating a portal login' });

  const { rows: existingRows } = await query(
    `select id, name, email, role, tenant_id, active
     from app_users
     where role='tenant' and tenant_id=$1
     order by active desc, name
     limit 1`,
    [tenant.id]
  );
  if (existingRows[0]) {
    return res.status(200).json({ account: existingRows[0], temporary_password: null, existing: true });
  }

  const temporaryPassword = crypto.randomBytes(9).toString('base64url') + 'A1!';
  const passwordHash = await hashPassword(temporaryPassword);

  try {
    const { rows } = await query(
      `insert into app_users(name, email, password_hash, role, tenant_id, active)
       values ($1, $2, $3, 'tenant', $4, true)
       returning id, name, email, role, tenant_id, active`,
      [tenant.name, tenant.email, passwordHash, tenant.id]
    );
    res.status(201).json({ account: rows[0], temporary_password: temporaryPassword, existing: false });
  } catch (err) {
    if (err?.code === '23505') return res.status(409).json({ error: 'An account with this email already exists. Link it from Admin Accounts.' });
    throw err;
  }
});

app.post('/admin/accounts/:id/reset-password', requireAuth, requireAdmin, async (req, res) => {
  const requestedPassword = String(req.body?.password || '').trim();
  const temporaryPassword = requestedPassword || (crypto.randomBytes(9).toString('base64url') + 'A1!');
  if (temporaryPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const passwordHash = await hashPassword(temporaryPassword);
  const { rows } = await query(
    'update app_users set password_hash=$2 where id=$1 returning id, name, email, role, tenant_id, active',
    [req.params.id, passwordHash]
  );
  const account = rows[0];
  if (!account) return res.status(404).json({ error: 'Account not found' });

  res.json({ account, temporary_password: temporaryPassword });
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
      if (field === 'tenant_id' && req.body.role === 'admin') value = null;
      values.push(value);
      updates.push(`${field}=$${values.length}`);
    }
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'password') && req.body.password) {
    values.push(await hashPassword(req.body.password));
    updates.push(`password_hash=$${values.length}`);
  }

  if (!updates.length) return res.status(400).json({ error: 'No fields supplied to update' });

  try {
    const { rows } = await query(
      `update app_users set ${updates.join(', ')} where id=$1 returning id, name, email, role, tenant_id, active`,
      values
    );
    sendOneOr404(res, rows, 'Account');
  } catch (err) {
    if (err?.code === '23505') return res.status(409).json({ error: 'An account with this email already exists' });
    throw err;
  }
});

app.get('/dashboard', requireAuth, async (req, res) => {
  const currentUser = await resolveTenantAccountLink(req.user);
  const isAdmin = currentUser.role === 'admin';
  const tenantId = currentUser.tenant_id;
  const tenantParams = isAdmin ? [] : [tenantId];

  if (!isAdmin && !tenantId) {
    return res.json({
      properties: [],
      tenants: [],
      rentPayments: [],
      maintenanceTickets: [],
      documents: [],
      expenses: [],
    });
  }

  const propertyWhere = isAdmin ? ' where p.deleted_at is null' : ' where p.deleted_at is null and p.id in (select property_id from tenants where id=$1 and deleted_at is null)';
  const tenantWhere = isAdmin ? ' where t.deleted_at is null' : ' where t.id=$1 and t.deleted_at is null';
  const rentWhere = isAdmin ? ' where r.deleted_at is null' : ' where r.deleted_at is null and r.tenant_id=$1';
  const maintWhere = isAdmin
    ? ' where m.deleted_at is null'
    : ' where m.deleted_at is null and (m.tenant_id=$1 or m.property_id in (select property_id from tenants where id=$1 and deleted_at is null))';
  const docWhere = isAdmin
    ? ' where d.deleted_at is null'
    : ` where d.deleted_at is null and (d.tenant_id=$1
        or d.property_id in (select property_id from tenants where id=$1 and deleted_at is null)
        or (d.tenant_id is null and d.property_id is null))`;
  const expenseWhere = isAdmin ? ' where e.deleted_at is null' : ' where false';
  const expenseParams = isAdmin ? [] : [];

  const [properties, tenants, rentPayments, maintenanceTickets, documents, expenses] = await Promise.all([
    query(`select p.* from properties p${propertyWhere} order by p.address`, tenantParams),
    query(
      `select t.*, row_to_json(p.*) as property
       from tenants t
       left join properties p on p.id=t.property_id and p.deleted_at is null
       ${tenantWhere}
       order by t.name`,
      tenantParams
    ),
    query(
      `select r.*, row_to_json(t.*) as tenant, row_to_json(p.*) as property
       from rent_payments r
       left join tenants t on t.id=r.tenant_id and t.deleted_at is null
       left join properties p on p.id=r.property_id and p.deleted_at is null
       ${rentWhere}
       order by r.due_date desc`,
      tenantParams
    ),
    query(
      `select m.*, row_to_json(p.*) as property, row_to_json(t.*) as tenant
       from maintenance_tickets m
       left join properties p on p.id=m.property_id and p.deleted_at is null
       left join tenants t on t.id=m.tenant_id and t.deleted_at is null
       ${maintWhere}
       order by m.created_at desc`,
      tenantParams
    ),
    query(
      `select d.*, row_to_json(p.*) as property, row_to_json(t.*) as tenant
       from documents d
       left join properties p on p.id=d.property_id and p.deleted_at is null
       left join tenants t on t.id=d.tenant_id and t.deleted_at is null
       ${docWhere}
       order by d.expiry_date nulls last`,
      tenantParams
    ),
    query(
      `select e.*, row_to_json(p.*) as property
       from expenses e
       left join properties p on p.id=e.property_id and p.deleted_at is null
       ${expenseWhere}
       order by e.date desc`,
      expenseParams
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
      summary: 'Official GOV.UK roadmap for private rented sector reforms. Review the roadmap before making tenancy or process changes.',
      source: 'GOV.UK',
      url: 'https://www.gov.uk/government/publications/renters-rights-act-2025-implementation-roadmap/implementing-the-renters-rights-act-2025-our-roadmap-for-reforming-the-private-rented-sector',
      effective_date: '2026-05-01',
      last_checked: '2026-06-05',
      severity: 'important',
    },
    {
      id: 'right-to-rent-checks',
      title: 'Right to rent checks',
      summary: 'Official GOV.UK service for landlords and agents to check a tenant right to rent using a share code.',
      source: 'GOV.UK',
      url: 'https://www.gov.uk/view-right-to-rent',
      effective_date: null,
      last_checked: '2026-06-05',
      severity: 'required',
    },
    {
      id: 'landlord-safety-responsibilities',
      title: 'Landlord safety responsibilities',
      summary: 'Official GOV.UK guidance covering key landlord safety responsibilities including gas safety and property safety duties.',
      source: 'GOV.UK',
      url: 'https://www.gov.uk/private-renting/your-landlords-safety-responsibilities',
      effective_date: null,
      last_checked: '2026-06-05',
      severity: 'required',
    },
    {
      id: 'smoke-carbon-monoxide-alarms',
      title: 'Smoke and carbon monoxide alarm requirements',
      summary: 'Official GOV.UK guidance on smoke and carbon monoxide alarm requirements for landlords.',
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

  const currentUser = await resolveTenantAccountLink(req.user);
  if (currentUser.role !== 'admin') {
    const allowed = await query('select 1 from tenants where id=$1 and property_id=$2 and deleted_at is null', [currentUser.tenant_id, property_id]);
    if (!allowed.rows[0]) return res.status(403).json({ error: 'Cannot create ticket for another property' });
  }

  const tenantId = currentUser.role === 'tenant' ? currentUser.tenant_id : req.body.tenant_id || null;
  const { rows } = await query(
    `insert into maintenance_tickets(title, description, property_id, tenant_id, urgency, status)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [title, description, property_id, tenantId, urgency, 'open']
  );
  res.status(201).json(rows[0]);
});



function docusignPrivateKey() {
  return (process.env.DOCUSIGN_PRIVATE_KEY || '').replace(/\\n/g, '\n');
}

function docusignConfigStatus() {
  const config = {
    integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY || '',
    userId: process.env.DOCUSIGN_USER_ID || '',
    accountId: process.env.DOCUSIGN_ACCOUNT_ID || '',
    privateKey: docusignPrivateKey(),
    baseUrl: process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net',
    oauthBaseUrl: process.env.DOCUSIGN_OAUTH_BASE_URL || 'account-d.docusign.com',
  };

  const missing = [];
  if (!config.integrationKey) missing.push('DOCUSIGN_INTEGRATION_KEY');
  if (!config.userId) missing.push('DOCUSIGN_USER_ID');
  if (!config.accountId) missing.push('DOCUSIGN_ACCOUNT_ID');
  if (!config.privateKey) missing.push('DOCUSIGN_PRIVATE_KEY');

  return {
    ready: missing.length === 0,
    missing,
    base_url: config.baseUrl,
    oauth_base_url: config.oauthBaseUrl,
    account_id_configured: Boolean(config.accountId),
    integration_key_configured: Boolean(config.integrationKey),
    user_id_configured: Boolean(config.userId),
    private_key_configured: Boolean(config.privateKey),
    config,
  };
}

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

async function docusignAccessToken(config) {
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = toBase64Url(JSON.stringify({
    iss: config.integrationKey,
    sub: config.userId,
    aud: config.oauthBaseUrl,
    iat: now,
    exp: now + 3600,
    scope: 'signature impersonation',
  }));
  const unsigned = header + '.' + payload;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), config.privateKey).toString('base64url');
  const assertion = unsigned + '.' + signature;

  const tokenResponse = await fetch('https://' + config.oauthBaseUrl + '/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const tokenJson = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok) {
    const detail = tokenJson.error_description || tokenJson.error || 'DocuSign token request failed';
    throw new Error(detail);
  }

  return tokenJson.access_token;
}

function agreementDocusignDocument(agreement) {
  const body = agreement.agreement_body || 'Tenancy agreement text missing.';

  return [
    body,
    '',
    '---',
    'Tenant signature:',
    '',
    'Signed date:',
  ].join('\n');
}

app.get('/docusign/status', requireAuth, requireAdmin, async (_req, res) => {
  const status = docusignConfigStatus();
  const { config, ...safeStatus } = status;
  res.json(safeStatus);
});

app.post('/tenancy-agreements/:id/docusign/send', requireAuth, requireAdmin, async (req, res) => {
  const status = docusignConfigStatus();
  if (!status.ready) {
    return res.status(400).json({
      error: 'DocuSign is not configured',
      missing: status.missing,
    });
  }

  const { rows } = await query(
    `select a.*, t.email as tenant_email, coalesce(t.name, a.tenant_name_snapshot) as tenant_display_name
     from tenancy_agreements a
     left join tenants t on t.id=a.tenant_id and t.deleted_at is null
     where a.id=$1`,
    [req.params.id]
  );

  const agreement = rows[0];
  if (!agreement) return res.status(404).json({ error: 'Tenancy agreement not found' });
  if (!agreement.tenant_email) return res.status(400).json({ error: 'Tenant email is required before sending via DocuSign' });
  if (agreement.status === 'signed') return res.status(400).json({ error: 'Signed agreements cannot be resent' });

  const accessToken = await docusignAccessToken(status.config);
  const documentText = agreementDocusignDocument(agreement);
  const documentBase64 = Buffer.from(documentText, 'utf8').toString('base64');

  const envelopeDefinition = {
    emailSubject: 'Please sign your tenancy agreement',
    emailBlurb: 'Please review and sign your tenancy agreement. This email was sent from PropManagerr via DocuSign.',
    documents: [
      {
        documentBase64,
        name: (agreement.agreement_title || 'Tenancy Agreement') + ' v' + (agreement.agreement_version || 1) + '.txt',
        fileExtension: 'txt',
        documentId: '1',
      },
    ],
    recipients: {
      signers: [
        {
          email: agreement.tenant_email,
          name: agreement.tenant_display_name || agreement.tenant_name_snapshot || 'Tenant',
          recipientId: '1',
          routingOrder: '1',
          tabs: {
            signHereTabs: [
              {
                documentId: '1',
                pageNumber: '1',
                xPosition: '120',
                yPosition: '700',
              },
            ],
            dateSignedTabs: [
              {
                documentId: '1',
                pageNumber: '1',
                xPosition: '120',
                yPosition: '750',
              },
            ],
          },
        },
      ],
    },
    status: 'sent',
  };

  const envelopeResponse = await fetch(status.config.baseUrl + '/restapi/v2.1/accounts/' + status.config.accountId + '/envelopes', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(envelopeDefinition),
  });

  const envelopeJson = await envelopeResponse.json().catch(() => ({}));
  if (!envelopeResponse.ok) {
    const detail = envelopeJson.message || envelopeJson.error || 'DocuSign envelope creation failed';
    throw new Error(detail);
  }

  const envelopeId = envelopeJson.envelopeId || envelopeJson.envelope_id || '';
  const updated = await query(
    `update tenancy_agreements
     set status='sent',
         docusign_envelope_id=$2,
         sent_at=coalesce(sent_at, now()),
         notes=$3,
         updated_at=now()
     where id=$1
     returning *`,
    [
      agreement.id,
      envelopeId,
      'Sent to tenant via DocuSign. Await signed return/download step.',
    ]
  );

  res.status(201).json({
    envelope_id: envelopeId,
    agreement: updated.rows[0],
  });
});


app.post('/tenancy-agreements/:id/docusign/complete', requireAuth, requireAdmin, async (req, res) => {
  const status = docusignConfigStatus();
  if (!status.ready) {
    return res.status(400).json({
      error: 'DocuSign is not configured',
      missing: status.missing,
    });
  }

  const { rows } = await query(
    `select a.*, row_to_json(t.*) as tenant, row_to_json(p.*) as property
     from tenancy_agreements a
     left join tenants t on t.id=a.tenant_id
     left join properties p on p.id=a.property_id
     where a.id=$1`,
    [req.params.id]
  );

  const agreement = rows[0];
  if (!agreement) return res.status(404).json({ error: 'Tenancy agreement not found' });
  if (!agreement.docusign_envelope_id) return res.status(400).json({ error: 'No DocuSign envelope ID is stored for this agreement' });

  const accessToken = await docusignAccessToken(status.config);
  const envelopeId = agreement.docusign_envelope_id;
  const envelopeUrl = status.config.baseUrl + '/restapi/v2.1/accounts/' + status.config.accountId + '/envelopes/' + encodeURIComponent(envelopeId);

  const envelopeResponse = await fetch(envelopeUrl, {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  const envelopeJson = await envelopeResponse.json().catch(() => ({}));
  if (!envelopeResponse.ok) {
    const detail = envelopeJson.message || envelopeJson.error || 'DocuSign envelope status check failed';
    throw new Error(detail);
  }

  const envelopeStatus = String(envelopeJson.status || '').toLowerCase();
  if (envelopeStatus !== 'completed') {
    return res.json({
      completed: false,
      envelope_status: envelopeJson.status || envelopeStatus || 'unknown',
      message: 'DocuSign envelope is not completed yet',
    });
  }

  const documentResponse = await fetch(envelopeUrl + '/documents/combined', {
    headers: {
      Authorization: 'Bearer ' + accessToken,
      Accept: 'application/pdf',
    },
  });
  if (!documentResponse.ok) {
    let detail = 'Could not download signed DocuSign document';
    try {
      const errorJson = await documentResponse.json();
      detail = errorJson.message || errorJson.error || detail;
    } catch {}
    throw new Error(detail);
  }

  const signedBuffer = Buffer.from(await documentResponse.arrayBuffer());
  const safeEnvelopeId = envelopeId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'envelope';
  const fileName = 'signed-tenancy-agreement-' + safeEnvelopeId + '-' + Date.now() + '.pdf';
  const documentsDir = new URL('../uploads/documents/', import.meta.url);
  await fs.mkdir(documentsDir, { recursive: true });
  await fs.writeFile(new URL(fileName, documentsDir), signedBuffer);
  const fileUrl = '/uploads/documents/' + fileName;

  const title = (agreement.agreement_title || 'Tenancy Agreement') + ' - signed DocuSign copy';
  const documentResult = await query(
    `insert into documents (property_id, tenant_id, name, doc_type, file_url)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [agreement.property_id || null, agreement.tenant_id || null, title, 'tenancy_agreement', fileUrl]
  );

  const updated = await query(
    `update tenancy_agreements
     set status='signed',
         signed_at=coalesce(signed_at, now()),
         signed_document_url=$2,
         notes=$3,
         updated_at=now()
     where id=$1
     returning *`,
    [
      agreement.id,
      fileUrl,
      'Signed DocuSign document downloaded and saved to Documents.',
    ]
  );

  res.json({
    completed: true,
    envelope_status: envelopeJson.status || 'completed',
    document: documentResult.rows[0],
    agreement: updated.rows[0],
  });
});

app.get('/tenancy-agreements', requireAuth, requireAdmin, async (req, res) => {
  const tenantId = req.query.tenant_id ? String(req.query.tenant_id) : '';
  const params = tenantId ? [tenantId] : [];
  const where = tenantId ? 'where a.tenant_id=$1' : '';

  const { rows } = await query(
    `select a.*, row_to_json(t.*) as tenant, row_to_json(p.*) as property
     from tenancy_agreements a
     left join tenants t on t.id=a.tenant_id
     left join properties p on p.id=a.property_id
     ${where}
     order by a.created_at desc`,
    params
  );
  res.json(rows);
});

app.post('/tenancy-agreements', requireAuth, requireAdmin, async (req, res) => {
  const tenantId = req.body?.tenant_id;
  if (!tenantId) return res.status(400).json({ error: 'Tenant is required' });

  const tenantResult = await query(
    `select t.*, p.address as property_address, p.postcode as property_postcode, p.monthly_rent
     from tenants t
     left join properties p on p.id=t.property_id and p.deleted_at is null
     where t.id=$1 and t.deleted_at is null`,
    [tenantId]
  );
  const tenant = tenantResult.rows[0];
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const versionResult = await query('select coalesce(max(agreement_version), 0) + 1 as next_version from tenancy_agreements where tenant_id=$1', [tenantId]);
  const nextVersion = Number(versionResult.rows[0]?.next_version || 1);

  const id = makeId();
  const { rows } = await query(
    `insert into tenancy_agreements (
       id, tenant_id, property_id, agreement_version, agreement_title, status,
       landlord_name, landlord_signed, tenant_name_snapshot, property_address_snapshot,
       property_postcode_snapshot, rent_snapshot, lease_start_snapshot, lease_end_snapshot,
       agreement_body, notes
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     returning *`,
    [
      id,
      tenant.id,
      tenant.property_id || null,
      nextVersion,
      req.body?.agreement_title || 'Tenancy Agreement',
      req.body?.status || 'draft',
      req.body?.landlord_name || 'Lee Robertson',
      req.body?.landlord_signed !== false,
      tenant.name,
      tenant.property_address || null,
      tenant.property_postcode || null,
      tenant.monthly_rent || null,
      tenant.lease_start || null,
      tenant.lease_end || null,
      req.body?.agreement_body || null,
      req.body?.notes || null,
    ]
  );

  res.status(201).json(rows[0]);
});

app.post('/tenancy-agreements/:id/save-document', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await query(
    `select a.*, row_to_json(t.*) as tenant, row_to_json(p.*) as property
     from tenancy_agreements a
     left join tenants t on t.id=a.tenant_id
     left join properties p on p.id=a.property_id
     where a.id=$1`,
    [req.params.id]
  );
  const agreement = rows[0];
  if (!agreement) return res.status(404).json({ error: 'Tenancy agreement not found' });

  const body = agreement.agreement_body || 'No agreement wording saved yet.';
  const safeTenant = String(agreement.tenant_name_snapshot || 'tenant')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()
    .replace(/\s+/g, '-') || 'tenant';
  const filename = `tenancy-agreement-${safeTenant}-v${agreement.agreement_version}-${Date.now()}.txt`;
  const filePath = `${documentUploadDir}/${filename}`;
  await fs.writeFile(filePath, body, 'utf8');
  const fileUrl = `/uploads/documents/${filename}`;

  const documentResult = await query(
    `insert into documents (property_id, tenant_id, name, doc_type, expiry_date, file_url)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [
      agreement.property_id || null,
      agreement.tenant_id,
      `Tenancy Agreement - ${agreement.tenant_name_snapshot} - v${agreement.agreement_version}`,
      'tenancy_agreement',
      agreement.lease_end_snapshot || null,
      fileUrl,
    ]
  );

  const updated = await query(
    'update tenancy_agreements set signed_document_url=$2, updated_at=now() where id=$1 returning *',
    [agreement.id, fileUrl]
  );

  res.status(201).json({ document: documentResult.rows[0], agreement: updated.rows[0] });
});

app.patch('/tenancy-agreements/:id', requireAuth, requireAdmin, async (req, res) => {
  const fields = [
    'agreement_title',
    'status',
    'landlord_name',
    'landlord_signed',
    'agreement_body',
    'docusign_envelope_id',
    'sent_at',
    'signed_at',
    'signed_document_url',
    'certificate_url',
    'notes',
  ];
  const updates = fields.filter((field) => Object.prototype.hasOwnProperty.call(req.body || {}, field));
  if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });

  const setSql = updates.map((field, index) => field + '=$' + (index + 2)).join(', ');
  const values = updates.map((field) => req.body[field]);
  const { rows } = await query(
    'update tenancy_agreements set ' + setSql + ', updated_at=now() where id=$1 returning *',
    [req.params.id, ...values]
  );
  sendOneOr404(res, rows, 'Tenancy agreement');
});

adminCrud('/properties', 'properties', ['address', 'city', 'postcode', 'status', 'monthly_rent', 'bedrooms', 'property_type'], 'Property');
adminCrud('/tenants', 'tenants', ['property_id', 'name', 'email', 'phone', 'lease_start', 'lease_end', 'payment_status'], 'Tenant');
adminCrud('/rent-payments', 'rent_payments', ['tenant_id', 'property_id', 'due_date', 'amount', 'status', 'paid_date', 'payment_method', 'notes'], 'Rent payment');
adminCrud('/maintenance-admin', 'maintenance_tickets', ['property_id', 'tenant_id', 'title', 'description', 'urgency', 'status', 'contractor', 'cost', 'notes'], 'Maintenance ticket');

async function normaliseDocumentPayload(body) {
  const tenantId = body.tenant_id || null;
  let propertyId = body.property_id || null;

  if (tenantId && !propertyId) {
    const { rows } = await query('select property_id from tenants where id=$1 and deleted_at is null', [tenantId]);
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

app.get('/documents', requireAuth, requireAdmin, async (_req, res) => {
  const { rows } = await query(`
    select d.*, p.address as property, t.name as tenant
    from documents d
    left join properties p on p.id=d.property_id and p.deleted_at is null
    left join tenants t on t.id=d.tenant_id and t.deleted_at is null
    where d.deleted_at is null
    order by d.created_at desc
  `);
  res.json(rows);
});

app.post('/documents', requireAuth, async (req, res) => {
  const currentUser = await resolveTenantAccountLink(req.user);
  const body = req.body || {};
  let payload;

  if (currentUser.role === 'tenant') {
    if (!currentUser.tenant_id) {
      return res.status(403).json({ error: 'No tenant record is linked to this login yet.' });
    }

    const { rows: tenantRows } = await query(
      'select id, property_id from tenants where id=$1 and deleted_at is null',
      [currentUser.tenant_id]
    );
    const tenant = tenantRows[0];
    if (!tenant) return res.status(403).json({ error: 'Tenant record could not be found.' });

    payload = {
      property_id: tenant.property_id || null,
      tenant_id: tenant.id,
      name: body.name ?? null,
      doc_type: body.doc_type || 'tenant_upload',
      expiry_date: null,
      file_url: body.file_url || null,
    };
  } else {
    payload = await normaliseDocumentPayload(body);
  }

  if (!payload.name) return res.status(400).json({ error: 'Document name is required' });

  const { rows } = await query(
    `insert into documents (property_id, tenant_id, name, doc_type, expiry_date, file_url)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [payload.property_id, payload.tenant_id, payload.name, payload.doc_type, payload.expiry_date, payload.file_url]
  );
  res.status(201).json(rows[0]);
});
app.patch('/documents/:id', requireAuth, requireAdmin, async (req, res) => {
  const payload = await normaliseDocumentPayload(req.body || {});
  const fields = ['property_id', 'tenant_id', 'name', 'doc_type', 'expiry_date', 'file_url'];
  const updates = fields.filter((field) => Object.prototype.hasOwnProperty.call(req.body, field));

  if (payload.tenant_id && !req.body.property_id && !updates.includes('property_id')) updates.push('property_id');
  if (!updates.length) return res.status(400).json({ error: 'No fields supplied to update' });

  const values = updates.map((field) => payload[field]);
  const setSql = updates.map((field, index) => `${field}=$${index + 2}`).join(', ');
  const { rows } = await query(`update documents set ${setSql} where id=$1 returning *`, [req.params.id, ...values]);
  sendOneOr404(res, rows, 'Document');
});

app.delete('/documents/:id', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await query('update documents set deleted_at=now() where id=$1 and deleted_at is null returning *', [req.params.id]);
  const deleted = rows[0];
  if (!deleted) return res.status(404).json({ error: 'Document not found' });

  return res.json(deleted);
});

app.post('/documents/upload', requireAuth, uploadDocumentFile, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ file_url: `/uploads/documents/${req.file.filename}`, original_name: req.file.originalname });
});

adminCrud('/expenses', 'expenses', ['property_id', 'date', 'category', 'description', 'amount', 'supplier', 'receipt_url', 'notes'], 'Expense');

async function applyRuntimeMigrations() {

  // Soft delete / undo support.
  for (const table of ['properties', 'tenants', 'rent_payments', 'maintenance_tickets', 'documents', 'expenses']) {
    await query(`alter table ${table} add column if not exists deleted_at timestamptz`);
  }

  // Expense form fields used by the admin UI.
  await query('alter table expenses add column if not exists supplier text');
  await query('alter table expenses add column if not exists receipt_url text');
  await query('alter table expenses add column if not exists notes text');


  // Tenancy agreement versioning foundation.
  await query(`
    create table if not exists tenancy_agreements (
      id text primary key,
      tenant_id uuid not null references tenants(id) on delete cascade,
      property_id uuid references properties(id) on delete set null,
      agreement_version integer not null default 1,
      agreement_title text not null default 'Tenancy Agreement',
      status text not null default 'draft',
      landlord_name text not null default 'Lee Robertson',
      landlord_signed boolean not null default true,
      tenant_name_snapshot text not null,
      property_address_snapshot text,
      property_postcode_snapshot text,
      rent_snapshot numeric,
      lease_start_snapshot date,
      lease_end_snapshot date,
      agreement_body text,
      docusign_envelope_id text,
      sent_at timestamptz,
      signed_at timestamptz,
      signed_document_url text,
      certificate_url text,
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await query(`alter table tenancy_agreements add column if not exists agreement_title text not null default 'Tenancy Agreement'`);
  await query(`alter table tenancy_agreements add column if not exists status text not null default 'draft'`);
  await query(`alter table tenancy_agreements add column if not exists landlord_name text not null default 'Lee Robertson'`);
  await query(`alter table tenancy_agreements add column if not exists landlord_signed boolean not null default true`);
  await query(`alter table tenancy_agreements add column if not exists agreement_body text`);
  await query(`alter table tenancy_agreements add column if not exists docusign_envelope_id text`);
  await query(`alter table tenancy_agreements add column if not exists sent_at timestamptz`);
  await query(`alter table tenancy_agreements add column if not exists signed_at timestamptz`);
  await query(`alter table tenancy_agreements add column if not exists signed_document_url text`);
  await query(`alter table tenancy_agreements add column if not exists certificate_url text`);
  await query(`alter table tenancy_agreements add column if not exists notes text`);

  await query('alter table documents alter column property_id drop not null');
  await query('alter table maintenance_tickets add column if not exists contractor text');
  await query('alter table maintenance_tickets add column if not exists cost numeric default 0');
  await query('alter table maintenance_tickets add column if not exists notes text');
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
