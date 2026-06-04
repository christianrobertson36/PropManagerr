import express from 'express';
import path from 'path';
import multer from 'multer';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(morgan('combined'));
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// --- Authentication middleware ---
function requireAdmin(req, res, next) {
  // Dummy admin check; replace with real JWT verification
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// --- Multer storage for document uploads ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads', 'documents'));
  },
  filename: (req, file, cb) => {
    const parsed = path.parse(file.originalname);
    const safeBaseName =
      parsed.name
        .replace(/[^a-zA-Z0-9-_ ]/g, '')
        .trim()
        .replace(/\s+/g, '-') || 'document';

    cb(null, `${safeBaseName}-${Date.now()}${parsed.ext.toLowerCase()}`);
  },
});

const upload = multer({ storage });

// --- Serve uploads as static files ---
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Document upload route ---
app.post('/documents/upload', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  res.json({
    file_url: `/uploads/documents/${req.file.filename}`,
    original_name: req.file.originalname,
  });
});

// --- Example health route ---
app.get('/', (req, res) => {
  res.send('PropManagerr API running');
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`PropManager API listening on ${PORT}`);
});
