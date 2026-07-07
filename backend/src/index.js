import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import { authRouter } from './routes/auth.js';
import { canteenRouter } from './routes/canteen.js';
import { adminRouter } from './routes/admin.js';
import { uploadsRoot } from './middleware/studentPhotoUpload.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 4000;
const origin = process.env.CLIENT_ORIGIN || true;

fs.mkdirSync(uploadsRoot, { recursive: true });

app.use(cors({ origin, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(uploadsRoot));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'escola-cantina-api' });
});

app.use('/api/auth', authRouter);
app.use('/api/canteen', canteenRouter);
app.use('/api/admin', adminRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Imagem muito grande (máx. 5 MB)' });
  }
  const msg = err.message || '';
  if (msg.includes('Use apenas JPEG') || msg.includes('JPEG, PNG')) {
    return res.status(400).json({ error: msg });
  }
  res.status(500).json({ error: err.message || 'Erro interno' });
});

app.listen(port, () => {
  console.log(`API em http://localhost:${port}`);
});
