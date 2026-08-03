require('dotenv').config();

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const { spawn } = require('child_process');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const { Server } = require('socket.io');

const dbLayer = require('./db');
const { COOKIE_NAME, hashPassword, verifyPassword, signToken, verifyToken, requireAdmin } = require('./auth');

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const UPLOADS_DIR = path.join(dbLayer.DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

function cookieOpts(maxAgeMs) {
  return {
    httpOnly: true,
    maxAge: maxAgeMs,
    sameSite: 'lax',
    secure: NODE_ENV === 'production'
  };
}

// Identifica cada dispositivo/navegador con una cookie propia, para poder
// aplicar "un voto por dispositivo" sin pedir ningún dato al público.
function ensureVoterId(req, res, next) {
  let voterId = req.cookies.voter_id;
  if (!voterId) {
    voterId = crypto.randomUUID();
    res.cookie('voter_id', voterId, cookieOpts(365 * 24 * 3600 * 1000));
  }
  req.voterId = voterId;
  next();
}
app.use(ensureVoterId);

const photoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${req.params.id}-${file.fieldname}-${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      return cb(new Error('Solo se admiten imágenes JPG, PNG, WEBP o GIF.'));
    }
    cb(null, true);
  }
});

const photoUploadFields = [
  { name: 'participant_0', maxCount: 1 },
  { name: 'participant_1', maxCount: 1 },
  { name: 'participant_2', maxCount: 1 },
  { name: 'participant_3', maxCount: 1 },
  { name: 'participant_4', maxCount: 1 },
  { name: 'banner', maxCount: 1 }
];

function toUploadUrl(filename) {
  return filename ? '/uploads/' + filename : null;
}

function editionMediaUrls(edition) {
  return {
    photos: edition.photos.map(toUploadUrl),
    banner: toUploadUrl(edition.banner)
  };
}

function buildPublicState() {
  const editionId = dbLayer.getActiveEditionId();
  const edition = editionId && dbLayer.getEdition(editionId);
  if (!edition) return { editionId: null };
  const state = {
    editionId: edition.id,
    year: edition.year,
    date: edition.date,
    names: edition.names,
    status: edition.status,
    timerStartedAt: edition.timerStartedAt,
    timerDurationSec: edition.timerDurationSec,
    published: edition.published,
    results: null,
    ...editionMediaUrls(edition)
  };
  if (edition.published) {
    state.results = dbLayer.getVoteCounts(edition.id);
  }
  return state;
}

function buildAdminState() {
  const editionId = dbLayer.getActiveEditionId();
  const edition = editionId && dbLayer.getEdition(editionId);
  if (!edition) return { editionId: null };
  return {
    editionId: edition.id,
    year: edition.year,
    date: edition.date,
    names: edition.names,
    status: edition.status,
    timerStartedAt: edition.timerStartedAt,
    timerDurationSec: edition.timerDurationSec,
    published: edition.published,
    results: dbLayer.getVoteCounts(edition.id),
    ...editionMediaUrls(edition)
  };
}

function broadcast() {
  io.emit('state', buildPublicState());
  io.to('admins').emit('admin-state', buildAdminState());
}

// ---------- Rutas públicas (sin registro, para el público general) ----------

app.get('/api/time', (req, res) => {
  res.json({ now: Date.now() });
});

app.get('/api/state', (req, res) => {
  res.json(buildPublicState());
});

app.get('/api/vote-status/:editionId', (req, res) => {
  res.json(dbLayer.getVoteStatus(req.params.editionId, req.voterId));
});

app.post('/api/vote', (req, res) => {
  const { editionId, candidateIndex } = req.body || {};
  if (!editionId || typeof candidateIndex !== 'number' || candidateIndex < 0 || candidateIndex > 4) {
    return res.status(400).json({ error: 'Datos de voto inválidos.' });
  }
  const edition = dbLayer.getEdition(editionId);
  if (!edition || edition.id !== dbLayer.getActiveEditionId()) {
    return res.status(400).json({ error: 'Esta edición ya no está activa.' });
  }
  if (edition.status !== 'voting') {
    return res.status(400).json({ error: 'La votación no está abierta.' });
  }
  const already = dbLayer.getVoteStatus(editionId, req.voterId);
  if (already.voted) {
    return res.json({ candidateIndex: already.candidateIndex, alreadyVoted: true });
  }
  try {
    dbLayer.insertVote(editionId, req.voterId, candidateIndex);
  } catch (e) {
    const existing = dbLayer.getVoteStatus(editionId, req.voterId);
    if (existing.voted) return res.json({ candidateIndex: existing.candidateIndex, alreadyVoted: true });
    return res.status(500).json({ error: 'No se pudo registrar el voto.' });
  }
  broadcast();
  res.json({ candidateIndex, alreadyVoted: false });
});

// ---------- Autenticación (solo para el administrador) ----------

app.post('/api/admin/register', (req, res) => {
  const { username, password, setupToken } = req.body || {};
  if (!process.env.ADMIN_SETUP_TOKEN || setupToken !== process.env.ADMIN_SETUP_TOKEN) {
    return res.status(403).json({ error: 'Código de configuración incorrecto.' });
  }
  if (!username || !password || password.length < 8) {
    return res.status(400).json({ error: 'Usuario y contraseña (mínimo 8 caracteres) son obligatorios.' });
  }
  if (dbLayer.getAdminByUsername(username)) {
    return res.status(409).json({ error: 'Ese usuario ya existe.' });
  }
  dbLayer.createAdmin(username, hashPassword(password));
  const admin = dbLayer.getAdminByUsername(username);
  res.cookie(COOKIE_NAME, signToken(admin), cookieOpts(30 * 24 * 3600 * 1000));
  res.status(201).json({ username });
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  const admin = username && dbLayer.getAdminByUsername(username);
  if (!admin || !verifyPassword(password || '', admin.password_hash)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }
  res.cookie(COOKIE_NAME, signToken(admin), cookieOpts(30 * 24 * 3600 * 1000));
  res.json({ username: admin.username });
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({ username: req.admin.username });
});

// ---------- Panel del organizador (protegido) ----------

app.get('/api/admin/state', requireAdmin, (req, res) => {
  res.json(buildAdminState());
});

app.get('/api/admin/backup', requireAdmin, (req, res) => {
  dbLayer.checkpoint();
  const filename = `votacion-monologos-backup-${new Date().toISOString().slice(0, 10)}.tar.gz`;
  const targets = ['votacion.db'];
  if (fs.existsSync(UPLOADS_DIR) && fs.readdirSync(UPLOADS_DIR).length > 0) targets.push('uploads');

  res.setHeader('Content-Type', 'application/gzip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const tar = spawn('tar', ['-czf', '-', '-C', dbLayer.DATA_DIR, ...targets]);
  tar.stdout.pipe(res);
  tar.on('error', () => {
    if (!res.headersSent) res.status(500).json({ error: 'No se pudo generar la copia de seguridad.' });
  });
});

app.get('/api/admin/editions', requireAdmin, (req, res) => {
  const activeId = dbLayer.getActiveEditionId();
  const editions = dbLayer.listEditions().map((ed) => ({
    ...ed,
    ...editionMediaUrls(ed),
    active: ed.id === activeId,
    counts: dbLayer.getVoteCounts(ed.id).counts
  }));
  res.json(editions);
});

app.get('/api/admin/editions/:id', requireAdmin, (req, res) => {
  const edition = dbLayer.getEdition(req.params.id);
  if (!edition) return res.status(404).json({ error: 'No existe esa edición.' });
  res.json({ ...edition, ...editionMediaUrls(edition) });
});

app.post('/api/admin/editions/:id/photos', requireAdmin, photoUpload.fields(photoUploadFields), (req, res) => {
  const edition = dbLayer.getEdition(req.params.id);
  if (!edition) return res.status(404).json({ error: 'No existe esa edición.' });

  const photos = edition.photos.slice();
  let banner = edition.banner;

  for (let i = 0; i < 5; i++) {
    const file = req.files && req.files['participant_' + i] && req.files['participant_' + i][0];
    if (file) {
      if (photos[i]) fs.unlink(path.join(UPLOADS_DIR, photos[i]), () => {});
      photos[i] = file.filename;
    }
  }
  const bannerFile = req.files && req.files.banner && req.files.banner[0];
  if (bannerFile) {
    if (banner) fs.unlink(path.join(UPLOADS_DIR, banner), () => {});
    banner = bannerFile.filename;
  }

  const updated = dbLayer.setPhotos(edition.id, photos, banner);
  broadcast();
  res.json({ ...updated, ...editionMediaUrls(updated) });
});

app.post('/api/admin/editions', requireAdmin, (req, res) => {
  const { year, date, names } = req.body || {};
  if (!year || !Array.isArray(names) || names.length !== 5 || names.some((n) => !n || !String(n).trim())) {
    return res.status(400).json({ error: 'Rellena el año y los 5 nombres.' });
  }
  const id = String(year);
  const edition = dbLayer.upsertEdition({
    id,
    year: Number(year),
    date,
    names: names.map((n) => String(n).trim())
  });
  dbLayer.setSetting('active_edition_id', id);
  broadcast();
  res.status(201).json(edition);
});

app.post('/api/admin/editions/:id/activate', requireAdmin, (req, res) => {
  const edition = dbLayer.getEdition(req.params.id);
  if (!edition) return res.status(404).json({ error: 'No existe esa edición.' });
  dbLayer.setSetting('active_edition_id', edition.id);
  broadcast();
  res.json(edition);
});

app.post('/api/admin/editions/:id/start', requireAdmin, (req, res) => {
  const edition = dbLayer.getEdition(req.params.id);
  if (!edition) return res.status(404).json({ error: 'No existe esa edición.' });
  if (edition.status !== 'draft') return res.status(400).json({ error: 'Esta edición ya se inició antes.' });
  const updated = dbLayer.startVoting(edition.id);
  broadcast();
  res.json(updated);
});

app.post('/api/admin/editions/:id/close', requireAdmin, (req, res) => {
  const edition = dbLayer.getEdition(req.params.id);
  if (!edition) return res.status(404).json({ error: 'No existe esa edición.' });
  const updated = dbLayer.closeVoting(edition.id);
  broadcast();
  res.json(updated);
});

app.post('/api/admin/editions/:id/publish', requireAdmin, (req, res) => {
  const edition = dbLayer.getEdition(req.params.id);
  if (!edition) return res.status(404).json({ error: 'No existe esa edición.' });
  const updated = dbLayer.setPublished(edition.id, !!(req.body || {}).published);
  broadcast();
  res.json(updated);
});

// ---------- Sockets (estado en vivo) ----------

function parseCookieHeader(header) {
  const out = {};
  (header || '').split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    if (key) out[key] = val;
  });
  return out;
}

io.on('connection', (socket) => {
  const cookies = parseCookieHeader(socket.handshake.headers.cookie);
  const payload = cookies[COOKIE_NAME] && verifyToken(cookies[COOKIE_NAME]);
  if (payload) {
    socket.join('admins');
    socket.emit('admin-state', buildAdminState());
  }
  socket.emit('state', buildPublicState());
});

// Errores de subida de fotos (archivo demasiado grande, tipo no admitido, etc.)
app.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ error: err.message || 'Error al procesar el archivo.' });
  }
  next();
});

server.listen(PORT, () => {
  console.log(`Votación de monólogos escuchando en el puerto ${PORT} (${NODE_ENV})`);
});
