import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha obrigatórios' });
  }
  const { rows } = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
  const admin = rows[0];
  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }
  const token = jwt.sign(
    { role: 'admin', username: admin.username, sub: String(admin.id) },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
  res.json({
    token,
    admin: { id: admin.id, username: admin.username },
  });
});
