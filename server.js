const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

// ---- Load .env manually (no extra dependency) ----
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ---- Email Setup ----
let transporter = null;
let emailError = null;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = (process.env.SMTP_PASS || '').trim().replace(/\s/g, '');
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || SMTP_USER;
const SMTP_CONFIGURED = SMTP_USER && SMTP_PASS && SMTP_PASS !== 'YOUR_APP_PASSWORD_HERE';

if (SMTP_CONFIGURED) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    requireTLS: true,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
  transporter.verify().then(() => {
    console.log('  ✉  Email configured and ready');
    emailError = null;
  }).catch(err => {
    emailError = err.message || String(err);
    console.error('  ✉  Email verify failed:', emailError);
    if (err.response) console.error('  ✉  Gmail response:', err.response);
    transporter = null;
  });
} else {
  console.log('  ⚠  Email not configured — set SMTP_USER and SMTP_PASS (use Gmail App Password)');
}

async function sendNotification(subject, htmlBody) {
  if (!transporter) {
    console.warn('  ✉  Skipped (no transporter):', subject);
    return;
  }
  try {
    await transporter.sendMail({
      from: `"Embersome" <${SMTP_USER}>`,
      to: NOTIFY_EMAIL,
      subject,
      html: htmlBody,
    });
    console.log('  ✉  Notification sent:', subject);
  } catch (err) {
    const msg = err.response ? `${err.message} | ${err.response}` : err.message;
    console.error('  ✉  Failed to send notification:', msg);
    if (err.responseCode) console.error('  ✉  Code:', err.responseCode);
  }
}

async function sendConfirmation(toEmail, toName, subject, htmlBody) {
  if (!transporter) return;
  try {
    await transporter.sendMail({
      from: `"Embersome" <${SMTP_USER}>`,
      to: toEmail,
      subject,
      html: htmlBody,
    });
    console.log('  ✉  Confirmation sent to:', toEmail);
  } catch (err) {
    const msg = err.response ? `${err.message} | ${err.response}` : err.message;
    console.error('  ✉  Failed to send confirmation to', toEmail, ':', msg);
  }
}

// ---- Middleware ----
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (but NOT admin.html — that's gated)
app.use(express.static(path.join(__dirname, 'public'), {
  index: 'index.html',
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    // Block direct access to admin files via static serve
    if (filePath.includes('admin.html') || filePath.includes('admin.css') || filePath.includes('admin.js')) {
      // We'll handle these via auth routes instead
    }
  }
}));

// ---- Session tokens (in-memory, simple) ----
const crypto = require('crypto');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'embersome2026';
const activeSessions = new Map(); // token -> { created, expires }
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, {
    created: Date.now(),
    expires: Date.now() + SESSION_DURATION,
  });
  return token;
}

function isValidSession(token) {
  if (!token) return false;
  const session = activeSessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expires) {
    activeSessions.delete(token);
    return false;
  }
  return true;
}

function getTokenFromReq(req) {
  // Check cookie first, then Authorization header
  var cookies = req.headers.cookie || '';
  var match = cookies.match(/ember_session=([a-f0-9]+)/);
  if (match) return match[1];
  var auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

// ---- Auth Routes ----
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = createSession();
    res.setHeader('Set-Cookie', `ember_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DURATION / 1000}`);
    console.log('[AUTH] Admin logged in');
    return res.json({ success: true });
  }
  console.log('[AUTH] Failed login attempt');
  res.status(401).json({ success: false, error: 'Wrong password' });
});

app.post('/api/auth/logout', (req, res) => {
  const token = getTokenFromReq(req);
  if (token) activeSessions.delete(token);
  res.setHeader('Set-Cookie', 'ember_session=; Path=/; HttpOnly; Max-Age=0');
  res.json({ success: true });
});

app.get('/api/auth/check', (req, res) => {
  const token = getTokenFromReq(req);
  res.json({ authenticated: isValidSession(token) });
});

// ---- Admin Auth Middleware ----
function requireAdmin(req, res, next) {
  const token = getTokenFromReq(req);
  if (isValidSession(token)) return next();
  // For API routes, return 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  // For page routes, redirect to login
  res.redirect('/login');
}

// ---- Login page (served without auth) ----
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ---- Protected admin routes ----
app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/admin.css', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.css'));
});
app.get('/admin.js', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.js'));
});

// ---- DB Helpers ----
function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch {
    return { accounts: [], chatters: [], weeklyRevenue: [], payroll: [], traffic: {}, settings: {} };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function genId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ---- Submission Helpers (public forms) ----
function saveSubmission(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  let list = [];
  if (fs.existsSync(filePath)) {
    try { list = JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { list = []; }
  }
  const entry = { id: genId('sub'), ...data, submittedAt: new Date().toISOString() };
  list.push(entry);
  fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf-8');
  return entry;
}

// ============================================
//  PUBLIC API — Landing Page Forms
// ============================================

app.post('/api/apply', async (req, res) => {
  const { name, email, platforms, audience, message } = req.body;
  const errors = [];
  if (!name || !name.trim()) errors.push('Name is required.');
  if (!email || !email.trim()) errors.push('Email is required.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.push('Invalid email.');
  if (errors.length) return res.status(400).json({ success: false, errors });

  const trimmed = {
    name: name.trim(), email: email.trim(),
    platforms: (platforms || '').trim(), audience: (audience || '').trim(), message: (message || '').trim(),
  };
  const entry = saveSubmission('applications.json', trimmed);
  console.log(`[APPLY] ${entry.name} <${entry.email}>`);

  // Send notification email to Embersome
  sendNotification(
    `New Application: ${trimmed.name}`,
    `<div style="font-family:sans-serif;color:#222;max-width:560px">
      <h2 style="color:#FF6A1A;margin-bottom:16px">New Application Received</h2>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px 12px;font-weight:600;color:#666;width:140px">Name</td><td style="padding:8px 12px">${trimmed.name}</td></tr>
        <tr style="background:#f9f9f9"><td style="padding:8px 12px;font-weight:600;color:#666">Email</td><td style="padding:8px 12px"><a href="mailto:${trimmed.email}">${trimmed.email}</a></td></tr>
        <tr><td style="padding:8px 12px;font-weight:600;color:#666">Platforms</td><td style="padding:8px 12px">${trimmed.platforms || '—'}</td></tr>
        <tr style="background:#f9f9f9"><td style="padding:8px 12px;font-weight:600;color:#666">Audience</td><td style="padding:8px 12px">${trimmed.audience || '—'}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:600;color:#666;vertical-align:top">Goals</td><td style="padding:8px 12px">${trimmed.message || '—'}</td></tr>
      </table>
      <p style="margin-top:20px;font-size:13px;color:#999">Submitted ${new Date().toLocaleString()}</p>
    </div>`
  );

  // Send confirmation to applicant
  sendConfirmation(
    trimmed.email, trimmed.name,
    "We got your application — Embersome",
    `<div style="font-family:sans-serif;color:#222;max-width:560px">
      <h2 style="color:#FF6A1A">Hey ${trimmed.name.split(' ')[0]},</h2>
      <p>Thanks for applying to work with Embersome. We've received your application and someone from our team will reach out within <strong>48 hours</strong>.</p>
      <p>In the meantime, if you have questions, reply to this email — we're real people, not a bot.</p>
      <p style="margin-top:24px">— The Embersome Team</p>
      <p style="font-size:12px;color:#999;margin-top:32px">membersomeagency@gmail.com</p>
    </div>`
  );

  res.json({ success: true, message: "Application received! We'll be in touch within 48 hours.", id: entry.id });
});

app.post('/api/book', async (req, res) => {
  const { name, email, preferredTime, topic } = req.body;
  const errors = [];
  if (!name || !name.trim()) errors.push('Name is required.');
  if (!email || !email.trim()) errors.push('Email is required.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.push('Invalid email.');
  if (errors.length) return res.status(400).json({ success: false, errors });

  const trimmed = {
    name: name.trim(), email: email.trim(),
    preferredTime: (preferredTime || '').trim(), topic: (topic || '').trim(),
  };
  const entry = saveSubmission('bookings.json', trimmed);
  console.log(`[BOOK] ${entry.name} <${entry.email}>`);

  // Send notification email to Embersome
  sendNotification(
    `New Call Request: ${trimmed.name}`,
    `<div style="font-family:sans-serif;color:#222;max-width:560px">
      <h2 style="color:#FF6A1A;margin-bottom:16px">New Call Booking</h2>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px 12px;font-weight:600;color:#666;width:140px">Name</td><td style="padding:8px 12px">${trimmed.name}</td></tr>
        <tr style="background:#f9f9f9"><td style="padding:8px 12px;font-weight:600;color:#666">Email</td><td style="padding:8px 12px"><a href="mailto:${trimmed.email}">${trimmed.email}</a></td></tr>
        <tr><td style="padding:8px 12px;font-weight:600;color:#666">Preferred Time</td><td style="padding:8px 12px">${trimmed.preferredTime || '—'}</td></tr>
        <tr style="background:#f9f9f9"><td style="padding:8px 12px;font-weight:600;color:#666;vertical-align:top">Topic</td><td style="padding:8px 12px">${trimmed.topic || '—'}</td></tr>
      </table>
      <p style="margin-top:20px;font-size:13px;color:#999">Submitted ${new Date().toLocaleString()}</p>
    </div>`
  );

  // Send confirmation to requester
  sendConfirmation(
    trimmed.email, trimmed.name,
    "Call request received — Embersome",
    `<div style="font-family:sans-serif;color:#222;max-width:560px">
      <h2 style="color:#FF6A1A">Hey ${trimmed.name.split(' ')[0]},</h2>
      <p>We got your call request. We'll reach out shortly to confirm a time that works for both of us.</p>
      ${trimmed.preferredTime ? '<p>You mentioned you prefer: <strong>' + trimmed.preferredTime + '</strong> — we\'ll do our best to match that.</p>' : ''}
      <p>Talk soon.</p>
      <p style="margin-top:24px">— The Embersome Team</p>
      <p style="font-size:12px;color:#999;margin-top:32px">membersomeagency@gmail.com</p>
    </div>`
  );

  res.json({ success: true, message: "Call request received! We'll confirm a time via email.", id: entry.id });
});

// ============================================
//  ADMIN API — Real data only (all protected)
// ============================================
app.use('/api/admin', requireAdmin);

function loadJSON(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { return []; }
}

// GET /api/admin/dashboard — Overview stats
app.get('/api/admin/dashboard', (req, res) => {
  const applications = loadJSON('applications.json');
  const bookings = loadJSON('bookings.json');

  // Today
  const today = new Date().toISOString().slice(0, 10);
  const todayApps = applications.filter(a => a.submittedAt && a.submittedAt.startsWith(today));
  const todayBooks = bookings.filter(b => b.submittedAt && b.submittedAt.startsWith(today));

  // This week (last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const weekApps = applications.filter(a => a.submittedAt >= weekAgo);
  const weekBooks = bookings.filter(b => b.submittedAt >= weekAgo);

  res.json({
    applications: { total: applications.length, today: todayApps.length, thisWeek: weekApps.length },
    bookings: { total: bookings.length, today: todayBooks.length, thisWeek: weekBooks.length },
    totalRequests: applications.length + bookings.length,
  });
});

// GET /api/admin/applications — All applications
app.get('/api/admin/applications', (req, res) => {
  const apps = loadJSON('applications.json');
  apps.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
  res.json(apps);
});

// GET /api/admin/bookings — All bookings
app.get('/api/admin/bookings', (req, res) => {
  const books = loadJSON('bookings.json');
  books.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
  res.json(books);
});

// DELETE /api/admin/applications/:id
app.delete('/api/admin/applications/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, 'applications.json');
  let apps = loadJSON('applications.json');
  apps = apps.filter(a => a.id !== req.params.id);
  fs.writeFileSync(filePath, JSON.stringify(apps, null, 2), 'utf-8');
  res.json({ success: true });
});

// DELETE /api/admin/bookings/:id
app.delete('/api/admin/bookings/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, 'bookings.json');
  let books = loadJSON('bookings.json');
  books = books.filter(b => b.id !== req.params.id);
  fs.writeFileSync(filePath, JSON.stringify(books, null, 2), 'utf-8');
  res.json({ success: true });
});

// GET /api/admin/email-test — Send a test email and return success or error (for debugging)
app.get('/api/admin/email-test', async (req, res) => {
  if (!SMTP_CONFIGURED) {
    return res.json({
      ok: false,
      message: 'SMTP not configured. Set SMTP_USER and SMTP_PASS (Gmail App Password) in Environment.',
    });
  }
  if (!transporter) {
    return res.json({
      ok: false,
      message: emailError ? `Connection failed: ${emailError}` : 'Transporter not ready yet. Wait a few seconds and try again.',
    });
  }
  try {
    await transporter.sendMail({
      from: `"Embersome" <${SMTP_USER}>`,
      to: NOTIFY_EMAIL,
      subject: 'Embersome email test',
      html: '<p>If you got this, email is working.</p>',
    });
    res.json({ ok: true, message: `Test email sent to ${NOTIFY_EMAIL}` });
  } catch (err) {
    const msg = err.response ? `${err.message} — ${err.response}` : err.message;
    res.status(500).json({ ok: false, message: msg });
  }
});

// ---- Catch-all ----
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---- Start ----
app.listen(PORT, () => {
  console.log('');
  console.log('  🔥 Embersome is running!');
  console.log(`  → Site:      http://localhost:${PORT}`);
  console.log(`  → Dashboard: http://localhost:${PORT}/admin`);
  console.log(`  → API:       http://localhost:${PORT}/api/admin/dashboard`);
  console.log('');
});
