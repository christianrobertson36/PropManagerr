import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { query } from './db.js';
import { comparePassword, requireAdmin, requireAuth, signUser } from './auth.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

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

app.patch('/rent-payments/:id', requireAuth, requireAdmin, async (req, res) => {
  const { status, paid_date } = req.body || {};
  const { rows } = await query('update rent_payments set status=coalesce($2,status), paid_date=$3 where id=$1 returning *', [req.params.id, status, paid_date ?? null]);
  if (!rows[0]) return res.status(404).json({ error: 'Payment not found' });
  res.json(rows[0]);
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`PropManager API listening on ${port}`));
