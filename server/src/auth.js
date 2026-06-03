import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from './db.js';
const secret = process.env.JWT_SECRET || 'dev-change-me';
export async function hashPassword(password) { return bcrypt.hash(password, 12); }
export async function comparePassword(password, hash) { return bcrypt.compare(password, hash); }
export function signUser(user) { return jwt.sign({ sub: user.id, role: user.role, tenant_id: user.tenant_id || null }, secret, { expiresIn: '12h' }); }
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const payload = jwt.verify(token, secret);
    const { rows } = await query('select id, name, email, role, tenant_id from app_users where id = $1 and active = true', [payload.sub]);
    if (!rows[0]) return res.status(401).json({ error: 'User not found' });
    req.user = rows[0];
    next();
  } catch { res.status(401).json({ error: 'Invalid or expired token' }); }
}
export function requireAdmin(req, res, next) { if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' }); next(); }
