import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { db, ensureSchema } from './src/db.js';

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const ORIGIN = process.env.CORS_ORIGIN || '*';
const DRIVE_PARENT_FOLDER_ID = process.env.DRIVE_PARENT_FOLDER_ID || '';
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_METRICS_SCHEMA = [
  { key: 'startTime', label: 'Czas rozpoczęcia zmiany', type: 'time' },
  { key: 'location', label: 'Lokalizacja startowa', type: 'text' },
  { key: 'odometerStart', label: 'Stan licznika (km)', type: 'number', unit: 'km' },
  { key: 'fuelLevel', label: 'Poziom paliwa', type: 'select', options: ['Pełny', '3/4', '1/2', '1/4', 'Rezerwa'] },
  { key: 'defLevel', label: 'Poziom AdBlue / DEF', type: 'select', options: ['Pełny', '3/4', '1/2', '1/4', 'Niski'] },
  { key: 'oilLevel', label: 'Poziom oleju', type: 'status', options: ['OK', 'Niski', 'Wymaga uzupełnienia'] },
  { key: 'coolantLevel', label: 'Poziom płynu chłodzącego', type: 'status', options: ['OK', 'Niski'] },
  { key: 'washerFluid', label: 'Płyn do spryskiwaczy', type: 'status', options: ['OK', 'Do uzupełnienia'] },
  { key: 'tyrePressure', label: 'Ciśnienie w oponach (uwagi)', type: 'text' },
  { key: 'cleanliness', label: 'Czystość kabiny', type: 'select', options: ['Wzorowa', 'Dobra', 'Wymaga uwagi'] },
  { key: 'issues', label: 'Usterki do zgłoszenia', type: 'textarea' },
  { key: 'notes', label: 'Dodatkowe notatki', type: 'textarea' }
];

const STATUS_LABELS = { ok: 'OK', issue: 'Wymaga uwagi', na: 'N/A' };
const STATUS_ICONS = { ok: '✔', issue: '⚠', na: '○' };

const ASSIGNMENT_SELECT = `
  SELECT a.id, a.user_id, a.vehicle_id, a.trailer_id, a.active, a.created_at,
         u.email AS user_email,
         v.registration, v.model,
         t.number AS trailer_number, t.id AS trailer_id
  FROM assignments a
  JOIN users u ON u.id = a.user_id
  JOIN vehicles v ON v.id = a.vehicle_id
  LEFT JOIN trailers t ON t.id = a.trailer_id
`;

function mapAssignment(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    vehicle_id: row.vehicle_id,
    trailer_id: row.trailer_id,
    active: row.active === 1 || row.active === true,
    created_at: row.created_at,
    user_email: row.user_email,
    registration: row.registration,
    model: row.model,
    trailer_number: row.trailer_number,
    trailer_id: row.trailer_id
  };
}

function getAssignmentById(id) {
  const row = db.prepare(`${ASSIGNMENT_SELECT} WHERE a.id = ?`).get(id);
  return mapAssignment(row);
}

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
    try {
      const contents = fs.readFileSync(GOOGLE_SERVICE_ACCOUNT_JSON, 'utf8');
      credentials = JSON.parse(contents);
    } catch (err) {
      console.error('Could not parse GOOGLE_SERVICE_ACCOUNT_JSON', err.message);
      return null;
    }
  }
  const scopes = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'];
  const privateKey = credentials.private_key?.replace(/\\n/g, '\n');
  const auth = new google.auth.JWT(
    credentials.client_email,
    undefined,
    privateKey,
    scopes,
    credentials.user || undefined
  );
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
  const rows = db
    .prepare(`
      SELECT v.id, v.registration, v.model, v.folder_id, v.created_at,
             a.id AS assignment_id, a.user_id AS driver_id,
             u.email AS driver_email
      FROM vehicles v
      LEFT JOIN assignments a ON a.id = (
        SELECT id FROM assignments WHERE vehicle_id = v.id AND active = 1 ORDER BY created_at DESC LIMIT 1
      )
      LEFT JOIN users u ON u.id = a.user_id
      ORDER BY v.created_at DESC
    `)
    .all();
  res.json({
    vehicles: rows.map(row => ({
      id: row.id,
      registration: row.registration,
      model: row.model,
      folder_id: row.folder_id,
      created_at: row.created_at,
      driver_id: row.driver_id || null,
      driver_email: row.driver_email || null,
      active_assignment_id: row.assignment_id || null
    }))
  });
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
  const rows = db
    .prepare(`
      SELECT t.id, t.number, t.created_at,
             a.id AS assignment_id, a.user_id AS driver_id, a.vehicle_id,
             u.email AS driver_email,
             v.registration AS vehicle_registration
      FROM trailers t
      LEFT JOIN assignments a ON a.id = (
        SELECT id FROM assignments WHERE trailer_id = t.id AND active = 1 ORDER BY created_at DESC LIMIT 1
      )
      LEFT JOIN users u ON u.id = a.user_id
      LEFT JOIN vehicles v ON v.id = a.vehicle_id
      ORDER BY t.created_at DESC
    `)
    .all();
  res.json({
    trailers: rows.map(row => ({
      id: row.id,
      number: row.number,
      created_at: row.created_at,
      driver_id: row.driver_id || null,
      driver_email: row.driver_email || null,
      vehicle_id: row.vehicle_id || null,
      vehicle_registration: row.vehicle_registration || null,
      active_assignment_id: row.assignment_id || null
    }))
  });
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
  const rows = db.prepare(`${ASSIGNMENT_SELECT} ORDER BY a.created_at DESC`).all();
  res.json({ assignments: rows.map(mapAssignment) });
});
app.post('/admin/assignments', auth, requireAdmin, (req, res) => {
  const { user_id, vehicle_id, trailer_id, active } = req.body || {};
  const userId = Number(user_id);
  const vehicleId = Number(vehicle_id);
  const trailerIdRaw = trailer_id === undefined || trailer_id === null || trailer_id === '' ? null : Number(trailer_id);

  if (!Number.isInteger(userId) || !Number.isInteger(vehicleId)) {
    return res.status(400).json({ error: 'user_id and vehicle_id required' });
  }
  if (trailerIdRaw !== null && !Number.isInteger(trailerIdRaw)) {
    return res.status(400).json({ error: 'invalid trailer_id' });
  }

  const driver = db.prepare("SELECT id, email FROM users WHERE id = ? AND role = 'driver'").get(userId);
  if (!driver) return res.status(404).json({ error: 'driver not found' });
  const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ?').get(vehicleId);
  if (!vehicle) return res.status(404).json({ error: 'vehicle not found' });
  if (trailerIdRaw !== null) {
    const trailer = db.prepare('SELECT id FROM trailers WHERE id = ?').get(trailerIdRaw);
    if (!trailer) return res.status(404).json({ error: 'trailer not found' });
  }

  const isActive = active === false ? 0 : 1;
  if (isActive) {
    db.prepare('UPDATE assignments SET active = 0 WHERE user_id = ? AND active = 1').run(userId);
    db.prepare('UPDATE assignments SET active = 0 WHERE vehicle_id = ? AND active = 1').run(vehicleId);
    if (trailerIdRaw) {
      db.prepare('UPDATE assignments SET active = 0 WHERE trailer_id = ? AND active = 1').run(trailerIdRaw);
    }
  }

  const info = db
    .prepare('INSERT INTO assignments (user_id, vehicle_id, trailer_id, active) VALUES (?, ?, ?, ?)')
    .run(userId, vehicleId, trailerIdRaw, isActive);
  const assignment = getAssignmentById(info.lastInsertRowid);
  res.status(201).json({ assignment });
});

app.patch('/admin/assignments/:id', auth, requireAdmin, (req, res) => {
  const assignmentId = Number(req.params.id);
  const { active } = req.body || {};
  if (!Number.isInteger(assignmentId)) return res.status(400).json({ error: 'invalid assignment id' });
  if (typeof active !== 'boolean') return res.status(400).json({ error: 'active boolean required' });

  const existing = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId);
  if (!existing) return res.status(404).json({ error: 'assignment not found' });

  if (active) {
    db.prepare('UPDATE assignments SET active = 0 WHERE user_id = ? AND id != ?').run(existing.user_id, assignmentId);
    db.prepare('UPDATE assignments SET active = 0 WHERE vehicle_id = ? AND id != ?').run(existing.vehicle_id, assignmentId);
    if (existing.trailer_id) {
      db.prepare('UPDATE assignments SET active = 0 WHERE trailer_id = ? AND id != ?').run(existing.trailer_id, assignmentId);
    }
  }

  db.prepare('UPDATE assignments SET active = ? WHERE id = ?').run(active ? 1 : 0, assignmentId);
  const assignment = getAssignmentById(assignmentId);
  res.json({ assignment });
});

app.get('/admin/drivers', auth, requireAdmin, (_req, res) => {
  const rows = db
    .prepare(`
      SELECT u.id, u.email, u.created_at,
             a.id AS assignment_id, a.vehicle_id, a.trailer_id, a.active,
             v.registration, v.model,
             t.number AS trailer_number
      FROM users u
      LEFT JOIN assignments a ON a.id = (
        SELECT id FROM assignments WHERE user_id = u.id AND active = 1 ORDER BY created_at DESC LIMIT 1
      )
      LEFT JOIN vehicles v ON v.id = a.vehicle_id
      LEFT JOIN trailers t ON t.id = a.trailer_id
      WHERE u.role = 'driver'
      ORDER BY u.created_at DESC
    `)
    .all();

  res.json({
    drivers: rows.map(row => ({
      id: row.id,
      email: row.email,
      created_at: row.created_at,
      assignment: row.assignment_id
        ? {
            id: row.assignment_id,
            vehicle_id: row.vehicle_id,
            trailer_id: row.trailer_id,
            registration: row.registration,
            model: row.model,
            trailer_number: row.trailer_number,
            active: row.active === 1
          }
        : null
    }))
  });
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
  if (!assignment) return res.json({ assignment: null, template: null, metricsSchema: DEFAULT_METRICS_SCHEMA });

  const template = db.prepare('SELECT * FROM checklist_templates WHERE active = 1 ORDER BY created_at DESC LIMIT 1').get();
  if (!template) return res.status(400).json({ error: 'no active checklist template' });
  const items = JSON.parse(template.items_json);
  const lastSubmission = db
    .prepare(
      `SELECT date, created_at, answers_json, metadata_json
       FROM checklist_submissions
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(req.user.sub);
  const history = lastSubmission
    ? {
        date: lastSubmission.date,
        created_at: lastSubmission.created_at,
        answers: JSON.parse(lastSubmission.answers_json),
        metadata: lastSubmission.metadata_json ? JSON.parse(lastSubmission.metadata_json) : null
      }
    : null;
  res.json({
    assignment,
    template: { id: template.id, name: template.name, items },
    metricsSchema: DEFAULT_METRICS_SCHEMA,
    lastSubmission: history
  });
});

// Driver submit
app.post('/driver/submit', auth, async (req, res) => {
  const { template_id, answers, date, metrics } = req.body || {};
  if (!Array.isArray(answers) || !template_id) {
    return res.status(400).json({ error: 'template_id and answers[] required' });
  }

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
  const templateItems = JSON.parse(template.items_json);

  let normalizedAnswers;
  try {
    normalizedAnswers = answers.map((entry, index) => {
      const label = (entry && typeof entry.label === 'string' && entry.label.trim()) || templateItems[index] || `Pozycja ${index + 1}`;
      const status = entry?.status;
      if (!['ok', 'issue', 'na'].includes(status)) {
        throw new Error('Każdy element checklisty musi mieć wybrany status');
      }
      return {
        label,
        status,
        note: entry?.note ? String(entry.note).trim() : ''
      };
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'invalid answers payload' });
  }

  if (normalizedAnswers.length !== templateItems.length) {
    return res.status(400).json({ error: 'answers length mismatch with template' });
  }

  let sanitizedMetrics = {};
  if (metrics && typeof metrics === 'object') {
    sanitizedMetrics = DEFAULT_METRICS_SCHEMA.reduce((acc, field) => {
      if (Object.prototype.hasOwnProperty.call(metrics, field.key)) {
        const raw = metrics[field.key];
        if (raw === null || raw === undefined || raw === '') {
          acc[field.key] = null;
        } else if (field.type === 'number') {
          const num = Number(String(raw).replace(',', '.'));
          acc[field.key] = Number.isFinite(num) ? num : null;
        } else {
          acc[field.key] = String(raw).trim();
        }
      }
      return acc;
    }, {});
  }

  const today = date || dayjs().format('YYYY-MM-DD');
  const info = db.prepare(
    `INSERT INTO checklist_submissions (user_id, vehicle_id, trailer_id, template_id, date, answers_json, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.user.sub,
    assignment.vehicle_id,
    assignment.trailer_id || null,
    template_id,
    today,
    JSON.stringify(normalizedAnswers),
    Object.keys(sanitizedMetrics).length ? JSON.stringify(sanitizedMetrics) : null
  );
  const submissionId = info.lastInsertRowid;

  // Generate PDF
  const pdfPath = path.join(DATA_DIR, `checklist_${assignment.registration}_${today}_${submissionId}.pdf`).replace(/\s+/g, '_');
  await generateChecklistPDF(pdfPath, {
    userEmail: req.user.email,
    date: today,
    vehicle: { registration: assignment.registration, model: assignment.model },
    trailer: assignment.trailer_number,
    templateName: template.name,
    answers: normalizedAnswers,
    metrics: sanitizedMetrics
  });

  // Upload to Drive
  let driveFileId = null;
  if (GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const drive = getDriveClient();
      if (drive) {
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
          parents: folderId ? [folderId] : DRIVE_PARENT_FOLDER_ID ? [DRIVE_PARENT_FOLDER_ID] : undefined
        };
        const media = { mimeType: 'application/pdf', body: fs.createReadStream(pdfPath) };
        const file = await drive.files.create({ requestBody: metadata, media, fields: 'id, name' });
        driveFileId = file.data.id;
        db.prepare('UPDATE checklist_submissions SET pdf_drive_file_id = ? WHERE id = ?').run(driveFileId, submissionId);
      }
    } catch (e) {
      console.error('Drive upload failed:', e.message);
    }
  }

  res.status(201).json({ ok: true, submission_id: submissionId, drive_file_id: driveFileId });
});

// PDF generator
async function generateChecklistPDF(outPath, { userEmail, date, vehicle, trailer, templateName, answers, metrics }) {
  const doc = new PDFDocument({ margin: 36 });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  const primaryColor = '#0f172a';
  const accentColor = '#2563eb';
  doc.fillColor(primaryColor);
  doc.fontSize(20).font('Helvetica-Bold').text('Raport Daily Vehicle Checklist', { align: 'center' });
  doc.moveDown(0.5);
  doc.fillColor('black').fontSize(12).font('Helvetica');
  doc.text(`Data raportu: ${dayjs(date).format('YYYY-MM-DD')}`);
  doc.text(`Kierowca: ${userEmail}`);
  doc.text(`Pojazd: ${vehicle.registration} (${vehicle.model})`);
  doc.text(`Trailer: ${trailer || '-'}`);
  doc.text(`Szablon: ${templateName}`);

  if (metrics && Object.keys(metrics).length) {
    doc.moveDown();
    doc.font('Helvetica-Bold').fillColor(primaryColor).text('Poranne odczyty i kontrole');
    doc.moveDown(0.3);
    doc.fillColor('black').font('Helvetica');
    DEFAULT_METRICS_SCHEMA.forEach(field => {
      if (
        Object.prototype.hasOwnProperty.call(metrics, field.key) &&
        metrics[field.key] !== undefined &&
        metrics[field.key] !== null &&
        metrics[field.key] !== ''
      ) {
        const value = metrics[field.key];
        doc.text(`• ${field.label}: ${value}${field.unit ? ' ' + field.unit : ''}`);
      }
    });
  }

  doc.moveDown();
  doc.font('Helvetica-Bold').fillColor(primaryColor).text('Walkaround checklist');
  doc.moveDown(0.3);
  answers.forEach((a, idx) => {
    const icon = STATUS_ICONS[a.status] || '-';
    const label = STATUS_LABELS[a.status] || a.status;
    doc.fillColor(accentColor).font('Helvetica-Bold').text(`${idx + 1}. ${icon} ${a.label}`);
    doc.fillColor('black').font('Helvetica').text(`Status: ${label}`);
    if (a.note) {
      doc.text(`Notatka: ${a.note}`);
    }
    doc.moveDown(0.2);
  });

  doc.end();
  await new Promise(resolve => stream.on('finish', resolve));
}
function osPathBase(p) {
  return p.split(/[/\\]/).pop();
}

app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
