import jwt from 'jsonwebtoken';

export function requireAdmin(req, res, next) {
  const h = req.headers.authorization;
  const token = h?.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Token ausente' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    req.admin = { id: payload.sub, username: payload.username };
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}
