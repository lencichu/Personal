const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error('Falta SESSION_SECRET en las variables de entorno (copia .env.example a .env y complétalo).');
}

const COOKIE_NAME = 'admin_token';

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function signToken(admin) {
  return jwt.sign({ sub: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '30d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function requireAdmin(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  const payload = token && verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'No autenticado.' });
  req.admin = payload;
  next();
}

module.exports = { COOKIE_NAME, hashPassword, verifyPassword, signToken, verifyToken, requireAdmin };
