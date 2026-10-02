const jwt = require('jsonwebtoken');

function getAdminCredentials() {
  return {
    username: String(process.env.ADMIN_USERNAME || process.env.ADMIN_EMAIL || 'admin').toLowerCase().trim(),
    password: String(process.env.ADMIN_PASSWORD || 'admin123'),
  };
}

function getJwtSecret() {
  return process.env.ADMIN_JWT_SECRET || 'prime-admin-dev-secret-change-me';
}

function signAdminToken(payload = {}) {
  return jwt.sign({ role: 'admin', ...payload }, getJwtSecret(), { expiresIn: '7d' });
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    req.admin = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = {
  getAdminCredentials,
  getJwtSecret,
  signAdminToken,
  requireAdmin,
};
