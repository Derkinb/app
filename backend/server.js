
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import PDFDocument from 'pdfkit';
import { google } from 'googleapis';
import { db, ensureSchema } from './src/db.js';

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const ORIGIN = process.env.CORS_ORIGIN || '*';
const DRIVE_PARENT_FOLDER_ID = process.env.DRIVE_PARENT_FOLDER_ID || '';
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';

app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(helmet());
app.use(express.json({ limit: '2mb' }));

ensureSchema();

// Google Drive auth (Service Account)
function getDriveClient() {
  if (!GOOGLE_SERVICE_ACCOUNT_JSON) return null;
  let credentials;
  try {
    credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch (e) {
    const fs = require('fs');
    credentials = JSON.parse(fs.readFileSync(GOOGLE_SERVICE_ACCOUNT_JSON, 'utf8'));
  }
  const scopes = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'];
  const auth = new google.auth.JWT(credentials.client_email, null, credentials.private_key, scopes, credentials.user);
  return google.drive({ version: 'v3', auth });
}

// Helpers
function sign(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}
function auth(req, res, next) {
  const authz = req.headers.authorization || '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid token' });
  }
}
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'admin only' });
  next();
}

// Health
app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

// Auth
app.post('/auth/register', (req, res) => {
  const { email, password, role } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'email already registered' });
  const hash = bcrypt.hashSync(password, 10);
  const userRole = role === 'admin' ? 'admin' : 'driver';
  const info = db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)').run(email.toLowerCase(), hash, userRole);
  const user = db.prepare('SELECT id, email, role, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);
  const token = sign(user);
  res.status(201).json({ token, user });
});
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'invalid credentials' });
  const token = sign(user);
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, created_at: user.created_at } });
});
app.get('/me', auth, (req, res) => {
  const user = db.prepare('SELECT id, email, role, created_at FROM users WHERE id = ?').get(req.user.sub);
  res.json({ user });
});

// Admin: vehicles
app.get('/admin/vehicles', auth, requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT * FROM vehicles ORDER BY created_at DESC').all();
  res.json({ vehicles: rows });
});
app.post('/admin/vehicles', auth, requireAdmin, async (req, res) => {
  const { registration, model } = req.body || {};
  if (!registration || !model) return res.status(400).json({ error: 'registration and model required' });
  try {
    const info = db.prepare('INSERT INTO vehicles (registration, model) VALUES (?, ?)').run(registration.trim(), model.trim());
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(info.lastInsertRowid);
    // Create Drive folder
    if (DRIVE_PARENT_FOLDER_ID && GOOGLE_SERVICE_ACCOUNT_JSON) {
      const drive = getDriveClient();
      if (drive) {
        const folder = await drive.files.create({
          requestBody: { name: `${vehicle.registration}`, mimeType: 'application/vnd.google-apps.folder', parents: [DRIVE_PARENT_FOLDER_ID] },
          fields: 'id,name'
        });
        db.prepare('UPDATE vehicles SET folder_id = ? WHERE id = ?').run(folder.data.id, vehicle.id);
        vehicle.folder_id = folder.data.id;
      }
    }
    res.status(201).json({ vehicle });
  } catch {
    res.status(400).json({ error: 'could not create vehicle (maybe duplicate registration)' });
  }
});

// Admin: trailers
app.get('/admin/trailers', auth, requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT * FROM trailers ORDER BY created_at DESC').all();
  res.json({ trailers: rows });
});
app.post('/admin/trailers', auth, requireAdmin, (req, res) => {
  const { number } = req.body || {};
  if (!number) return res.status(400).json({ error: 'number required' });
  try {
    const info = db.prepare('INSERT INTO trailers (number) VALUES (?)').run(number.trim());
    const trailer = db.prepare('SELECT * FROM trailers WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ trailer });
  } catch {
    res.status(400).json({ error: 'could not create trailer (maybe duplicate)' });
  }
});

// Admin: assignments
app.get('/admin/assignments', auth, requireAdmin, (_req, res) => {
  const rows = db.prepare(`
    SELECT a.id, a.active, u.email as user_email, u.id as user_id, v.registration, v.id as vehicle_id, t.number as trailer_number, t.id as trailer_id, a.created_at
    FROM assignments a
    JOIN users u ON u.id = a.user_id
    JOIN vehicles v ON v.id = a.vehicle_id
    LEFT JOIN trailers t ON t.id = a.trailer_id
    ORDER BY a.created_at DESC
  `).all();
  res.json({ assignments: rows });
});
app.post('/admin/assignments', auth, requireAdmin, (req, res) => {
  const { user_id, vehicle_id, trailer_id, active } = req.body || {};
  if (!user_id || !vehicle_id) return res.status(400).json({ error: 'user_id and vehicle_id required' });
  const info = db.prepare('INSERT INTO assignments (user_id, vehicle_id, trailer_id, active) VALUES (?, ?, ?, ?)').run(user_id, vehicle_id, trailer_id || null, active ? 1 : 1);
  const row = db.prepare('SELECT * FROM assignments WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ assignment: row });
});

// Admin: checklist templates
app.get('/admin/checklist-templates', auth, requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT * FROM checklist_templates WHERE active = 1 ORDER BY created_at DESC').all();
  res.json({ templates: rows.map(r => ({ ...r, items: JSON.parse(r.items_json) })) });
});
app.post('/admin/checklist-templates', auth, requireAdmin, (req, res) => {
  const { name, items } = req.body || {};
  if (!name || !Array.isArray(items) || !items.length) return res.status(400).json({ error: 'name and items[] required' });
  const info = db.prepare('INSERT INTO checklist_templates (name, items_json) VALUES (?, ?)').run(name, JSON.stringify(items));
  const row = db.prepare('SELECT * FROM checklist_templates WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ template: { ...row, items } });
});

// Driver daily
app.get('/driver/daily', auth, (req, res) => {
  if (req.user.role !== 'driver' && req.user.role !== 'admin') return res.status(403).json({ error: 'driver only' });
  const assignment = db.prepare(`
    SELECT a.*, v.registration, v.model, t.number as trailer_number
    FROM assignments a
    JOIN vehicles v ON v.id = a.vehicle_id
    LEFT JOIN trailers t ON t.id = a.trailer_id
    WHERE a.user_id = ? AND a.active = 1
    ORDER BY a.created_at DESC
    LIMIT 1
  `).get(req.user.sub);
  if (!assignment) return res.json({ assignment: null, template: null });

  const template = db.prepare('SELECT * FROM checklist_templates WHERE active = 1 ORDER BY created_at DESC LIMIT 1').get();
  const items = JSON.parse(template.items_json);
  res.json({
    assignment,
    template: { id: template.id, name: template.name, items }
  });
});

// Driver submit
app.post('/driver/submit', auth, async (req, res) => {
  const { template_id, answers, date } = req.body || {};
  if (!Array.isArray(answers) || !template_id) return res.status(400).json({ error: 'template_id and answers[] required' });

  const assignment = db.prepare(`
    SELECT a.*, v.registration, v.model, v.folder_id, t.number as trailer_number
    FROM assignments a
    JOIN vehicles v ON v.id = a.vehicle_id
    LEFT JOIN trailers t ON t.id = a.trailer_id
    WHERE a.user_id = ? AND a.active = 1
    ORDER BY a.created_at DESC
    LIMIT 1
  `).get(req.user.sub);
  if (!assignment) return res.status(400).json({ error: 'no active assignment' });

  const template = db.prepare('SELECT * FROM checklist_templates WHERE id = ?').get(template_id);
  if (!template) return res.status(400).json({ error: 'invalid template' });

  const today = date || dayjs().format('YYYY-MM-DD');
  const info = db.prepare(`
    INSERT INTO checklist_submissions (user_id, vehicle_id, trailer_id, template_id, date, answers_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.user.sub, assignment.vehicle_id, assignment.trailer_id || null, template_id, today, JSON.stringify(answers));
  const submissionId = info.lastInsertRowid;

  // Generate PDF
  const pdfPath = `./data/checklist_${assignment.registration}_${today}_${submissionId}.pdf`.replace(/\s+/g, '_');
  await generateChecklistPDF(pdfPath, {
    userEmail: req.user.email,
    date: today,
    vehicle: { registration: assignment.registration, model: assignment.model },
    trailer: assignment.trailer_number,
    templateName: template.name,
    answers
  });

  // Upload to Drive
  let driveFileId = null;
  if (GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const drive = getDriveClient();
      let folderId = assignment.folder_id;
      if (!folderId && DRIVE_PARENT_FOLDER_ID) {
        const folder = await drive.files.create({
          requestBody: { name: `${assignment.registration}`, mimeType: 'application/vnd.google-apps.folder', parents: [DRIVE_PARENT_FOLDER_ID] },
          fields: 'id'
        });
        folderId = folder.data.id;
        db.prepare('UPDATE vehicles SET folder_id = ? WHERE id = ?').run(folderId, assignment.vehicle_id);
      }
      const metadata = {
        name: osPathBase(pdfPath),
        parents: folderId ? [folderId] : (DRIVE_PARENT_FOLDER_ID ? [DRIVE_PARENT_FOLDER_ID] : undefined)
      };
      const media = { mimeType: 'application/pdf', body: require('fs').createReadStream(pdfPath) };
      const file = await drive.files.create({ requestBody: metadata, media, fields: 'id, name' });
      driveFileId = file.data.id;
      db.prepare('UPDATE checklist_submissions SET pdf_drive_file_id = ? WHERE id = ?').run(driveFileId, submissionId);
    } catch (e) {
      console.error('Drive upload failed:', e.message);
    }
  }

  res.status(201).json({ ok: true, submission_id: submissionId, drive_file_id: driveFileId });
});

// PDF generator
async function generateChecklistPDF(outPath, { userEmail, date, vehicle, trailer, templateName, answers }) {
  const fs = require('fs');
  const doc = new PDFDocument({ margin: 36 });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  doc.fontSize(18).text('Daily Vehicle Checklist', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Date: ${date}`);
  doc.text(`Driver: ${userEmail}`);
  doc.text(`Vehicle: ${vehicle.registration} (${vehicle.model})`);
  doc.text(`Trailer: ${trailer || '-'}`);
  doc.moveDown(0.5);
  doc.text(`Template: ${templateName}`);
  doc.moveDown();

  answers.forEach((a, idx) => {
    const status = a.checked ? '✔' : '✖';
    doc.text(`${idx + 1}. [${status}] ${a.label}${a.note ? ' — Note: ' + a.note : ''}`);
  });

  doc.end();
  await new Promise(resolve => stream.on('finish', resolve));
}
function osPathBase(p) { return p.split(/[/\\]/).pop(); }

app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
