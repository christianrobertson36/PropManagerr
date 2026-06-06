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
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(next, 'hex'));
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
  return {
    token: `local-${row.id}`,
    user: publicUser(row),
  };
}

function all(table) {
  return db.prepare(`SELECT * FROM ${table} ORDER BY created_at DESC`).all();
}

function dashboard(user) {
  const properties = all('properties');
  const tenants = all('tenants').map((tenant) => ({
    ...tenant,
    property: tenant.property_id ? properties.find((property) => property.id === tenant.property_id) || null : null,
  }));
  const rentPayments = all('rent_payments');
  const maintenanceTickets = all('maintenance_tickets');
  const documents = all('documents').map((document) => ({
    ...document,
    property: document.property_id ? properties.find((property) => property.id === document.property_id) || null : null,
    tenant: document.tenant_id ? tenants.find((tenant) => tenant.id === document.tenant_id) || null : null,
  }));
  const expenses = all('expenses');

  if (user?.role === 'tenant' && user.tenant_id) {
    const tenant = tenants.find((row) => row.id === user.tenant_id);
    const propertyId = tenant?.property_id || null;
    return {
      properties: propertyId ? properties.filter((row) => row.id === propertyId) : [],
      tenants: tenant ? [tenant] : [],
      rentPayments: rentPayments.filter((row) => row.tenant_id === user.tenant_id),
      maintenanceTickets: maintenanceTickets.filter((row) => row.tenant_id === user.tenant_id || (propertyId && row.property_id === propertyId)),
      documents: documents.filter((row) => !row.property_id && !row.tenant_id || row.tenant_id === user.tenant_id || (propertyId && row.property_id === propertyId)),
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

function complianceUpdates() {
  return db.prepare('SELECT * FROM compliance_updates ORDER BY last_checked DESC, title ASC').all();
}

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
    SET address=@address,
        city=@city,
        postcode=@postcode,
        status=@status,
        monthly_rent=@monthly_rent,
        bedrooms=@bedrooms,
        property_type=@property_type,
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

module.exports = {
  openDatabase,
  login,
  dashboard,
  health,
  complianceUpdates,
  createProperty,
  updateProperty,
  deleteProperty,
};
