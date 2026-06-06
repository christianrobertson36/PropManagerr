const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');

let db;
let paths;

function id(prefix = '') {
  return `${prefix}${crypto.randomUUID()}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const next = hashPassword(password, salt).split(':')[1];
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(next, 'hex'));
  } catch {
    return false;
  }
}

function getPaths(app) {
  const root = path.join(app.getPath('userData'), 'local-data');
  const uploads = path.join(root, 'uploads');
  const backups = path.join(root, 'backups');
  const database = path.join(root, 'propmanagerr.sqlite');
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(uploads, { recursive: true });
  fs.mkdirSync(backups, { recursive: true });
  return { root, uploads, backups, database };
}

function openDatabase(app) {
  if (db) return { db, paths };
  paths = getPaths(app);
  db = new Database(paths.database);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  seed(db);
  return { db, paths };
}

function migrate(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'tenant')),
      tenant_id TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      city TEXT DEFAULT '',
      postcode TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      monthly_rent REAL NOT NULL DEFAULT 0,
      bedrooms INTEGER NOT NULL DEFAULT 0,
      property_type TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      lease_start TEXT,
      lease_end TEXT,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rent_payments (
      id TEXT PRIMARY KEY,
      tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
      property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
      amount REAL NOT NULL DEFAULT 0,
      due_date TEXT NOT NULL,
      paid_date TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_method TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
      tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      doc_type TEXT NOT NULL DEFAULT 'other',
      expiry_date TEXT,
      file_url TEXT DEFAULT '',
      original_name TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS maintenance_tickets (
      id TEXT PRIMARY KEY,
      property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
      tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      urgency TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open',
      contractor TEXT,
      cost REAL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
      date TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      description TEXT DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS compliance_updates (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      source TEXT NOT NULL,
      url TEXT DEFAULT '',
      effective_date TEXT,
      last_checked TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info'
    );
  `);
}

function seed(database) {
  const userCount = database.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (userCount === 0) {
    database.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, active)
      VALUES (@id, @name, @email, @password_hash, 'admin', 1)
    `).run({
      id: id('usr_'),
      name: 'Admin',
      email: 'admin@propmanager.local',
      password_hash: hashPassword('ChangeMe123!'),
    });
  }

  const complianceCount = database.prepare('SELECT COUNT(*) AS count FROM compliance_updates').get().count;
  if (complianceCount === 0) {
    const today = new Date().toISOString().slice(0, 10);
    database.prepare(`
      INSERT INTO compliance_updates (id, title, summary, source, url, effective_date, last_checked, severity)
      VALUES (@id, @title, @summary, @source, @url, @effective_date, @last_checked, @severity)
    `).run({
      id: id('cmp_'),
      title: 'Compliance updates ready',
      summary: 'Local desktop compliance update list is available. Add verified UK legal/compliance sources in a future update.',
      source: 'PropManagerr Local',
      url: '',
      effective_date: null,
      last_checked: today,
      severity: 'info',
    });
  }
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    tenant_id: row.tenant_id || null,
    active: Boolean(row.active),
  };
}

function login(email, password) {
  const row = db.prepare('SELECT * FROM users WHERE lower(email)=lower(?) AND active=1').get(email);
  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new Error('Invalid email or password');
  }
  return { token: `local-${row.id}`, user: publicUser(row) };
}

function all(table) {
  return db.prepare(`SELECT * FROM ${table} ORDER BY created_at DESC`).all();
}

function normaliseNullableId(value) {
  const raw = value === undefined || value === null ? '' : String(value).trim();
  return raw || null;
}

function propertyFor(idValue, properties) {
  return idValue ? properties.find((row) => row.id === idValue) || null : null;
}

function tenantFor(idValue, tenants) {
  return idValue ? tenants.find((row) => row.id === idValue) || null : null;
}

function withTenantAndProperty(payment, tenants, properties) {
  return {
    ...payment,
    tenant: tenantFor(payment.tenant_id, tenants),
    property: propertyFor(payment.property_id, properties),
  };
}

function dashboard(user) {
  const properties = all('properties');
  const tenants = all('tenants').map((tenant) => ({
    ...tenant,
    property: propertyFor(tenant.property_id, properties),
  }));
  const rentPayments = all('rent_payments').map((payment) => withTenantAndProperty(payment, tenants, properties));
  const maintenanceTickets = all('maintenance_tickets').map((ticket) => ({
    ...ticket,
    property: propertyFor(ticket.property_id, properties),
    tenant: tenantFor(ticket.tenant_id, tenants),
  }));
  const documents = all('documents').map((document) => ({
    ...document,
    property: propertyFor(document.property_id, properties),
    tenant: tenantFor(document.tenant_id, tenants),
  }));
  const expenses = all('expenses').map((expense) => ({
    ...expense,
    property: propertyFor(expense.property_id, properties),
  }));

  if (user?.role === 'tenant' && user.tenant_id) {
    const tenant = tenants.find((row) => row.id === user.tenant_id);
    const propertyId = tenant?.property_id || null;
    return {
      properties: propertyId ? properties.filter((row) => row.id === propertyId) : [],
      tenants: tenant ? [tenant] : [],
      rentPayments: rentPayments.filter((row) => row.tenant_id === user.tenant_id),
      maintenanceTickets: maintenanceTickets.filter((row) => row.tenant_id === user.tenant_id || (propertyId && row.property_id === propertyId)),
      documents: documents.filter((row) => (!row.property_id && !row.tenant_id) || row.tenant_id === user.tenant_id || (propertyId && row.property_id === propertyId)),
      expenses: [],
    };
  }

  return { properties, tenants, rentPayments, maintenanceTickets, documents, expenses };
}

function health() {
  const tables = ['users', 'properties', 'tenants', 'rent_payments', 'documents', 'maintenance_tickets', 'expenses', 'compliance_updates'];
  const counts = Object.fromEntries(tables.map((table) => [table, db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count]));
  return { ok: true, database: paths.database, uploads: paths.uploads, counts };
}


function ensureDefaultComplianceUpdates() {
  const today = new Date().toISOString().slice(0, 10);
  const updates = [
    {
      id: id('cmp_'),
      title: 'How to rent guide',
      summary: 'Check the current GOV.UK How to rent guide before starting or renewing a tenancy.',
      source: 'GOV.UK',
      url: 'https://www.gov.uk/government/publications/how-to-rent',
      effective_date: null,
      last_checked: today,
      severity: 'required',
    },
    {
      id: id('cmp_'),
      title: 'Gas safety',
      summary: 'Check current gas safety responsibilities and keep certificates/records where required.',
      source: 'HSE',
      url: 'https://www.hse.gov.uk/gas/landlords/',
      effective_date: null,
      last_checked: today,
      severity: 'required',
    },
    {
      id: id('cmp_'),
      title: 'Electrical safety',
      summary: 'Check current electrical safety responsibilities and keep inspection/report records where required.',
      source: 'GOV.UK',
      url: 'https://www.gov.uk/guidance/electrical-safety-standards-in-the-private-rented-sector-guidance-for-landlords-tenants-and-local-authorities',
      effective_date: null,
      last_checked: today,
      severity: 'required',
    },
    {
      id: id('cmp_'),
      title: 'Deposit protection',
      summary: 'Check deposit protection rules and keep prescribed information records where required.',
      source: 'GOV.UK',
      url: 'https://www.gov.uk/deposit-protection-schemes-and-landlords',
      effective_date: null,
      last_checked: today,
      severity: 'required',
    },
    {
      id: id('cmp_'),
      title: 'Renters Reform / Renters Rights',
      summary: 'Check current UK Parliament/GOV.UK updates before changing tenancy notices, possession processes, or tenancy terms.',
      source: 'UK Parliament',
      url: 'https://bills.parliament.uk/',
      effective_date: null,
      last_checked: today,
      severity: 'important',
    },
  ];

  const insert = db.prepare(`
    INSERT INTO compliance_updates (id, title, summary, source, url, effective_date, last_checked, severity)
    VALUES (@id, @title, @summary, @source, @url, @effective_date, @last_checked, @severity)
  `);

  const existingTitles = new Set(
    db.prepare('SELECT title FROM compliance_updates').all().map(row => row.title)
  );

  const missingUpdates = updates.filter(row => !existingTitles.has(row.title));
  if (missingUpdates.length === 0) return;

  const tx = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });

  tx(missingUpdates);
}

function complianceUpdates() { ensureDefaultComplianceUpdates(); return db.prepare('SELECT * FROM compliance_updates ORDER BY last_checked DESC, title ASC').all(); }

function createProperty(property) {
  const row = {
    id: id('prop_'),
    address: String(property.address || '').trim(),
    city: String(property.city || '').trim(),
    postcode: String(property.postcode || '').trim(),
    status: property.status || 'active',
    monthly_rent: Number(property.monthly_rent || 0),
    bedrooms: Number(property.bedrooms || 0),
    property_type: String(property.property_type || '').trim(),
  };
  if (!row.address) throw new Error('Property address is required');
  db.prepare(`
    INSERT INTO properties (id, address, city, postcode, status, monthly_rent, bedrooms, property_type)
    VALUES (@id, @address, @city, @postcode, @status, @monthly_rent, @bedrooms, @property_type)
  `).run(row);
  return db.prepare('SELECT * FROM properties WHERE id=?').get(row.id);
}

function updateProperty(propertyId, property) {
  const existing = db.prepare('SELECT * FROM properties WHERE id=?').get(propertyId);
  if (!existing) throw new Error('Property not found');
  const row = {
    id: propertyId,
    address: property.address !== undefined ? String(property.address || '').trim() : existing.address,
    city: property.city !== undefined ? String(property.city || '').trim() : existing.city,
    postcode: property.postcode !== undefined ? String(property.postcode || '').trim() : existing.postcode,
    status: property.status !== undefined ? property.status : existing.status,
    monthly_rent: property.monthly_rent !== undefined ? Number(property.monthly_rent || 0) : existing.monthly_rent,
    bedrooms: property.bedrooms !== undefined ? Number(property.bedrooms || 0) : existing.bedrooms,
    property_type: property.property_type !== undefined ? String(property.property_type || '').trim() : existing.property_type,
  };
  if (!row.address) throw new Error('Property address is required');
  db.prepare(`
    UPDATE properties
    SET address=@address, city=@city, postcode=@postcode, status=@status,
        monthly_rent=@monthly_rent, bedrooms=@bedrooms, property_type=@property_type,
        updated_at=CURRENT_TIMESTAMP
    WHERE id=@id
  `).run(row);
  return db.prepare('SELECT * FROM properties WHERE id=?').get(propertyId);
}

function deleteProperty(propertyId) {
  const existing = db.prepare('SELECT * FROM properties WHERE id=?').get(propertyId);
  if (!existing) throw new Error('Property not found');
  db.prepare('DELETE FROM properties WHERE id=?').run(propertyId);
  return existing;
}

function createTenant(tenant) {
  const propertyId = normaliseNullableId(tenant.property_id);
  if (propertyId && !db.prepare('SELECT id FROM properties WHERE id=?').get(propertyId)) {
    throw new Error('Selected property was not found');
  }
  const row = {
    id: id('ten_'),
    property_id: propertyId,
    name: String(tenant.name || '').trim(),
    email: String(tenant.email || '').trim(),
    phone: String(tenant.phone || '').trim(),
    lease_start: tenant.lease_start || null,
    lease_end: tenant.lease_end || null,
    payment_status: tenant.payment_status || 'pending',
  };
  if (!row.name) throw new Error('Tenant name is required');
  db.prepare(`
    INSERT INTO tenants (id, property_id, name, email, phone, lease_start, lease_end, payment_status)
    VALUES (@id, @property_id, @name, @email, @phone, @lease_start, @lease_end, @payment_status)
  `).run(row);
  return db.prepare('SELECT * FROM tenants WHERE id=?').get(row.id);
}

function updateTenant(tenantId, tenant) {
  const existing = db.prepare('SELECT * FROM tenants WHERE id=?').get(tenantId);
  if (!existing) throw new Error('Tenant not found');
  const propertyId = tenant.property_id !== undefined ? normaliseNullableId(tenant.property_id) : existing.property_id || null;
  if (propertyId && !db.prepare('SELECT id FROM properties WHERE id=?').get(propertyId)) {
    throw new Error('Selected property was not found');
  }
  const row = {
    id: tenantId,
    property_id: propertyId,
    name: tenant.name !== undefined ? String(tenant.name || '').trim() : existing.name,
    email: tenant.email !== undefined ? String(tenant.email || '').trim() : existing.email,
    phone: tenant.phone !== undefined ? String(tenant.phone || '').trim() : existing.phone,
    lease_start: tenant.lease_start !== undefined ? tenant.lease_start || null : existing.lease_start,
    lease_end: tenant.lease_end !== undefined ? tenant.lease_end || null : existing.lease_end,
    payment_status: tenant.payment_status !== undefined ? tenant.payment_status || 'pending' : existing.payment_status,
  };
  if (!row.name) throw new Error('Tenant name is required');
  db.prepare(`
    UPDATE tenants
    SET property_id=@property_id, name=@name, email=@email, phone=@phone,
        lease_start=@lease_start, lease_end=@lease_end, payment_status=@payment_status,
        updated_at=CURRENT_TIMESTAMP
    WHERE id=@id
  `).run(row);
  return db.prepare('SELECT * FROM tenants WHERE id=?').get(tenantId);
}

function deleteTenant(tenantId) {
  const existing = db.prepare('SELECT * FROM tenants WHERE id=?').get(tenantId);
  if (!existing) throw new Error('Tenant not found');
  db.prepare('DELETE FROM tenants WHERE id=?').run(tenantId);
  return existing;
}

function tenantPropertyId(tenantId) {
  if (!tenantId) return null;
  const tenant = db.prepare('SELECT property_id FROM tenants WHERE id=?').get(tenantId);
  if (!tenant) throw new Error('Selected tenant was not found');
  return tenant.property_id || null;
}

function getRentPayment(paymentId) {
  const payment = db.prepare('SELECT * FROM rent_payments WHERE id=?').get(paymentId);
  if (!payment) return null;
  const properties = all('properties');
  const tenants = all('tenants');
  return withTenantAndProperty(payment, tenants, properties);
}

function createRentPayment(payment) {
  const tenantId = normaliseNullableId(payment.tenant_id);
  const propertyId = normaliseNullableId(payment.property_id) || tenantPropertyId(tenantId);
  if (!tenantId) throw new Error('Tenant is required');
  const row = {
    id: id('rent_'),
    tenant_id: tenantId,
    property_id: propertyId,
    amount: Number(payment.amount || 0),
    due_date: String(payment.due_date || '').slice(0, 10),
    paid_date: payment.paid_date || null,
    status: payment.status || 'pending',
    payment_method: String(payment.payment_method || '').trim(),
    notes: String(payment.notes || '').trim(),
  };
  if (!row.due_date) throw new Error('Due date is required');
  db.prepare(`
    INSERT INTO rent_payments (id, tenant_id, property_id, amount, due_date, paid_date, status, payment_method, notes)
    VALUES (@id, @tenant_id, @property_id, @amount, @due_date, @paid_date, @status, @payment_method, @notes)
  `).run(row);
  return getRentPayment(row.id);
}

function updateRentPayment(paymentId, payment) {
  const existing = db.prepare('SELECT * FROM rent_payments WHERE id=?').get(paymentId);
  if (!existing) throw new Error('Rent payment not found');
  const tenantId = payment.tenant_id !== undefined ? normaliseNullableId(payment.tenant_id) : existing.tenant_id;
  const propertyId = payment.property_id !== undefined ? normaliseNullableId(payment.property_id) : existing.property_id;
  const row = {
    id: paymentId,
    tenant_id: tenantId,
    property_id: propertyId,
    amount: payment.amount !== undefined ? Number(payment.amount || 0) : existing.amount,
    due_date: payment.due_date !== undefined ? String(payment.due_date || '').slice(0, 10) : existing.due_date,
    paid_date: payment.paid_date !== undefined ? payment.paid_date || null : existing.paid_date,
    status: payment.status !== undefined ? payment.status || 'pending' : existing.status,
    payment_method: payment.payment_method !== undefined ? String(payment.payment_method || '').trim() : existing.payment_method,
    notes: payment.notes !== undefined ? String(payment.notes || '').trim() : existing.notes,
  };
  if (!row.tenant_id) throw new Error('Tenant is required');
  if (!row.due_date) throw new Error('Due date is required');
  db.prepare(`
    UPDATE rent_payments
    SET tenant_id=@tenant_id, property_id=@property_id, amount=@amount,
        due_date=@due_date, paid_date=@paid_date, status=@status,
        payment_method=@payment_method, notes=@notes, updated_at=CURRENT_TIMESTAMP
    WHERE id=@id
  `).run(row);
  return getRentPayment(paymentId);
}

function deleteRentPayment(paymentId) {
  const existing = getRentPayment(paymentId);
  if (!existing) throw new Error('Rent payment not found');
  db.prepare('DELETE FROM rent_payments WHERE id=?').run(paymentId);
  return existing;
}

function createExpense(expense) {
  const propertyId = normaliseNullableId(expense.property_id);
  const row = {
    id: id('exp_'),
    property_id: propertyId,
    date: String(expense.date || new Date().toISOString().slice(0, 10)).slice(0, 10),
    category: String(expense.category || 'General').trim() || 'General',
    description: String(expense.description || '').trim(),
    amount: Number(expense.amount || 0),
  };
  db.prepare(`
    INSERT INTO expenses (id, property_id, date, category, description, amount)
    VALUES (@id, @property_id, @date, @category, @description, @amount)
  `).run(row);
  return db.prepare('SELECT * FROM expenses WHERE id=?').get(row.id);
}

function updateExpense(expenseId, expense) {
  const existing = db.prepare('SELECT * FROM expenses WHERE id=?').get(expenseId);
  if (!existing) throw new Error('Expense not found');
  const row = {
    id: expenseId,
    property_id: expense.property_id !== undefined ? normaliseNullableId(expense.property_id) : existing.property_id || null,
    date: expense.date !== undefined ? String(expense.date || '').slice(0, 10) : existing.date,
    category: expense.category !== undefined ? String(expense.category || 'General').trim() : existing.category,
    description: expense.description !== undefined ? String(expense.description || '').trim() : existing.description,
    amount: expense.amount !== undefined ? Number(expense.amount || 0) : existing.amount,
  };
  db.prepare(`
    UPDATE expenses
    SET property_id=@property_id, date=@date, category=@category, description=@description,
        amount=@amount, updated_at=CURRENT_TIMESTAMP
    WHERE id=@id
  `).run(row);
  return db.prepare('SELECT * FROM expenses WHERE id=?').get(expenseId);
}

function deleteExpense(expenseId) {
  const existing = db.prepare('SELECT * FROM expenses WHERE id=?').get(expenseId);
  if (!existing) throw new Error('Expense not found');
  db.prepare('DELETE FROM expenses WHERE id=?').run(expenseId);
  return existing;
}

function createMaintenanceTicket(ticket) {
  const tenantId = normaliseNullableId(ticket.tenant_id);
  const propertyId = normaliseNullableId(ticket.property_id) || tenantPropertyId(tenantId);
  const row = {
    id: id('mnt_'),
    property_id: propertyId,
    tenant_id: tenantId,
    title: String(ticket.title || '').trim(),
    description: String(ticket.description || '').trim(),
    urgency: ticket.urgency || 'medium',
    status: ticket.status || 'open',
    contractor: ticket.contractor || null,
    cost: ticket.cost === undefined || ticket.cost === null || ticket.cost === '' ? null : Number(ticket.cost),
    notes: ticket.notes || null,
  };
  if (!row.title) throw new Error('Repair title is required');
  db.prepare(`
    INSERT INTO maintenance_tickets (id, property_id, tenant_id, title, description, urgency, status, contractor, cost, notes)
    VALUES (@id, @property_id, @tenant_id, @title, @description, @urgency, @status, @contractor, @cost, @notes)
  `).run(row);
  return db.prepare('SELECT * FROM maintenance_tickets WHERE id=?').get(row.id);
}

function updateMaintenanceTicket(ticketId, ticket) {
  const existing = db.prepare('SELECT * FROM maintenance_tickets WHERE id=?').get(ticketId);
  if (!existing) throw new Error('Repair ticket not found');
  const row = {
    id: ticketId,
    property_id: ticket.property_id !== undefined ? normaliseNullableId(ticket.property_id) : existing.property_id || null,
    tenant_id: ticket.tenant_id !== undefined ? normaliseNullableId(ticket.tenant_id) : existing.tenant_id || null,
    title: ticket.title !== undefined ? String(ticket.title || '').trim() : existing.title,
    description: ticket.description !== undefined ? String(ticket.description || '').trim() : existing.description,
    urgency: ticket.urgency !== undefined ? ticket.urgency || 'medium' : existing.urgency,
    status: ticket.status !== undefined ? ticket.status || 'open' : existing.status,
    contractor: ticket.contractor !== undefined ? ticket.contractor || null : existing.contractor,
    cost: ticket.cost !== undefined ? (ticket.cost === null || ticket.cost === '' ? null : Number(ticket.cost)) : existing.cost,
    notes: ticket.notes !== undefined ? ticket.notes || null : existing.notes,
  };
  if (!row.title) throw new Error('Repair title is required');
  db.prepare(`
    UPDATE maintenance_tickets
    SET property_id=@property_id, tenant_id=@tenant_id, title=@title, description=@description,
        urgency=@urgency, status=@status, contractor=@contractor, cost=@cost, notes=@notes,
        updated_at=CURRENT_TIMESTAMP
    WHERE id=@id
  `).run(row);
  return db.prepare('SELECT * FROM maintenance_tickets WHERE id=?').get(ticketId);
}

function deleteMaintenanceTicket(ticketId) {
  const existing = db.prepare('SELECT * FROM maintenance_tickets WHERE id=?').get(ticketId);
  if (!existing) throw new Error('Repair ticket not found');
  db.prepare('DELETE FROM maintenance_tickets WHERE id=?').run(ticketId);
  return existing;
}

function safeFileName(name) {
  return String(name || 'document').replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 180) || 'document';
}

function fileUrlFromPath(filePath) {
  return 'file:///' + filePath.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1:');
}

function pathFromFileUrl(fileUrl) {
  if (!fileUrl || !String(fileUrl).startsWith('file:///')) return null;
  const without = String(fileUrl).replace('file:///', '');
  return without.replace(/^([A-Za-z]):/, '$1:').replace(/\//g, path.sep);
}

function uploadDocumentFile(payload) {
  if (!payload || !payload.name || !Array.isArray(payload.data)) {
    throw new Error('No document file was supplied');
  }
  fs.mkdirSync(paths.uploads, { recursive: true });
  const originalName = safeFileName(payload.name);
  const ext = path.extname(originalName);
  const storedName = id('docfile_') + ext;
  const target = path.join(paths.uploads, storedName);
  fs.writeFileSync(target, Buffer.from(payload.data));
  return { file_url: fileUrlFromPath(target), original_name: originalName };
}

function createDocument(document) {
  const row = {
    id: id('doc_'),
    property_id: normaliseNullableId(document.property_id),
    tenant_id: normaliseNullableId(document.tenant_id),
    name: String(document.name || document.original_name || 'Document').trim(),
    doc_type: String(document.doc_type || 'other').trim() || 'other',
    expiry_date: document.expiry_date || null,
    file_url: String(document.file_url || '').trim(),
    original_name: String(document.original_name || document.name || '').trim(),
  };
  if (!row.name) throw new Error('Document name is required');
  db.prepare(`
    INSERT INTO documents (id, property_id, tenant_id, name, doc_type, expiry_date, file_url, original_name)
    VALUES (@id, @property_id, @tenant_id, @name, @doc_type, @expiry_date, @file_url, @original_name)
  `).run(row);
  return db.prepare('SELECT * FROM documents WHERE id=?').get(row.id);
}

function updateDocument(documentId, document) {
  const existing = db.prepare('SELECT * FROM documents WHERE id=?').get(documentId);
  if (!existing) throw new Error('Document not found');
  const row = {
    id: documentId,
    property_id: document.property_id !== undefined ? normaliseNullableId(document.property_id) : existing.property_id || null,
    tenant_id: document.tenant_id !== undefined ? normaliseNullableId(document.tenant_id) : existing.tenant_id || null,
    name: document.name !== undefined ? String(document.name || '').trim() : existing.name,
    doc_type: document.doc_type !== undefined ? String(document.doc_type || 'other').trim() : existing.doc_type,
    expiry_date: document.expiry_date !== undefined ? document.expiry_date || null : existing.expiry_date,
    file_url: document.file_url !== undefined ? String(document.file_url || '').trim() : existing.file_url,
    original_name: document.original_name !== undefined ? String(document.original_name || '').trim() : existing.original_name,
  };
  if (!row.name) throw new Error('Document name is required');
  db.prepare(`
    UPDATE documents
    SET property_id=@property_id, tenant_id=@tenant_id, name=@name, doc_type=@doc_type,
        expiry_date=@expiry_date, file_url=@file_url, original_name=@original_name,
        updated_at=CURRENT_TIMESTAMP
    WHERE id=@id
  `).run(row);
  return db.prepare('SELECT * FROM documents WHERE id=?').get(documentId);
}

function deleteDocument(documentId) {
  const existing = db.prepare('SELECT * FROM documents WHERE id=?').get(documentId);
  if (!existing) throw new Error('Document not found');
  db.prepare('DELETE FROM documents WHERE id=?').run(documentId);
  const localPath = pathFromFileUrl(existing.file_url);
  if (localPath && localPath.startsWith(paths.uploads) && fs.existsSync(localPath)) {
    try { fs.unlinkSync(localPath); } catch {}
  }
  return existing;
}

function listAdminAccounts() {
  const tenants = all('tenants');
  return db.prepare('SELECT id, name, email, role, tenant_id, active, created_at, updated_at FROM users ORDER BY created_at DESC')
    .all()
    .map((row) => ({
      ...row,
      active: Boolean(row.active),
      tenant: tenantFor(row.tenant_id, tenants),
    }));
}

function createAdminAccount(account) {
  const role = account.role === 'tenant' ? 'tenant' : 'admin';
  const tenantId = role === 'tenant' ? normaliseNullableId(account.tenant_id) : null;
  if (role === 'tenant' && !tenantId) throw new Error('Tenant account must be linked to a tenant');
  if (tenantId && !db.prepare('SELECT id FROM tenants WHERE id=?').get(tenantId)) throw new Error('Selected tenant was not found');
  const row = {
    id: id('usr_'),
    name: String(account.name || '').trim(),
    email: String(account.email || '').trim().toLowerCase(),
    password_hash: hashPassword(account.password || 'ChangeMe123!'),
    role,
    tenant_id: tenantId,
    active: account.active === false ? 0 : 1,
  };
  if (!row.name) throw new Error('Account name is required');
  if (!row.email) throw new Error('Account email is required');
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, tenant_id, active)
    VALUES (@id, @name, @email, @password_hash, @role, @tenant_id, @active)
  `).run(row);
  return listAdminAccounts().find((accountRow) => accountRow.id === row.id);
}

function updateAdminAccount(accountId, account) {
  const existing = db.prepare('SELECT * FROM users WHERE id=?').get(accountId);
  if (!existing) throw new Error('Account not found');
  const role = account.role !== undefined ? (account.role === 'tenant' ? 'tenant' : 'admin') : existing.role;
  const tenantId = role === 'tenant'
    ? (account.tenant_id !== undefined ? normaliseNullableId(account.tenant_id) : existing.tenant_id || null)
    : null;
  if (role === 'tenant' && !tenantId) throw new Error('Tenant account must be linked to a tenant');
  if (tenantId && !db.prepare('SELECT id FROM tenants WHERE id=?').get(tenantId)) throw new Error('Selected tenant was not found');

  const row = {
    id: accountId,
    name: account.name !== undefined ? String(account.name || '').trim() : existing.name,
    email: account.email !== undefined ? String(account.email || '').trim().toLowerCase() : existing.email,
    role,
    tenant_id: tenantId,
    active: account.active !== undefined ? (account.active ? 1 : 0) : existing.active,
  };
  if (!row.name) throw new Error('Account name is required');
  if (!row.email) throw new Error('Account email is required');

  db.prepare(`
    UPDATE users
    SET name=@name, email=@email, role=@role, tenant_id=@tenant_id, active=@active, updated_at=CURRENT_TIMESTAMP
    WHERE id=@id
  `).run(row);

  if (account.password) {
    db.prepare('UPDATE users SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(hashPassword(account.password), accountId);
  }

  return listAdminAccounts().find((accountRow) => accountRow.id === accountId);
}

function deleteAdminAccount(accountId) { const existing = db.prepare('SELECT id, name, email, role, tenant_id, active, created_at, updated_at FROM users WHERE id=?').get(accountId); if (!existing) throw new Error('Account not found'); if (existing.role === 'admin' && existing.active) { const activeAdminCount = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='admin' AND active=1").get().count; if (activeAdminCount <= 1) throw new Error('Cannot delete the last active admin account'); } db.prepare('DELETE FROM users WHERE id=?').run(accountId); return { ...existing, active: Boolean(existing.active), tenant: tenantFor(existing.tenant_id, all('tenants')) }; } module.exports = {
  openDatabase,
  login,
  dashboard,
  health,
  complianceUpdates,
  createProperty,
  updateProperty,
  deleteProperty,
  createTenant,
  updateTenant,
  deleteTenant,
  createRentPayment,
  updateRentPayment,
  deleteRentPayment,
  createExpense,
  updateExpense,
  deleteExpense,
  createMaintenanceTicket,
  updateMaintenanceTicket,
  deleteMaintenanceTicket,
  uploadDocumentFile,
  createDocument,
  updateDocument,
  deleteDocument,
  listAdminAccounts,
  createAdminAccount,
  updateAdminAccount, deleteAdminAccount,
};
