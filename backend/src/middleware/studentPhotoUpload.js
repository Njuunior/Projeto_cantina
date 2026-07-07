import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const uploadsRoot = path.resolve(__dirname, '..', '..', 'uploads');
export const studentsDir = path.join(uploadsRoot, 'students');

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

function ensureStudentsDir() {
  fs.mkdirSync(studentsDir, { recursive: true });
}

export function resolvePublicUploadPath(relPath) {
  if (!relPath || relPath.includes('..')) return null;
  const full = path.join(uploadsRoot, relPath);
  if (!full.startsWith(uploadsRoot)) return null;
  return full;
}

export function deleteStudentPhotoFile(relPath) {
  const full = resolvePublicUploadPath(relPath);
  if (full && fs.existsSync(full)) {
    try {
      fs.unlinkSync(full);
    } catch {
      /* ignore */
    }
  }
}

export const studentPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureStudentsDir();
      cb(null, studentsDir);
    },
    filename: (_req, file, cb) => {
      const raw = path.extname(file.originalname || '').toLowerCase();
      const ext = ALLOWED_EXT.has(raw) ? raw : '.jpg';
      cb(null, `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Use apenas JPEG, PNG, GIF ou WebP.'));
    }
  },
});

/** Após INSERT do aluno: renomeia arquivo temporário para students/student-{id}{ext} */
export function finalizeNewStudentPhoto(studentId, file) {
  if (!file?.path) return null;
  const ext = path.extname(file.filename) || '.jpg';
  const rel = `students/student-${studentId}${ext}`;
  const dest = path.join(uploadsRoot, rel);
  try {
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    fs.renameSync(file.path, dest);
  } catch (e) {
    try {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    } catch {
      /* ignore */
    }
    throw e;
  }
  return rel;
}

/** Substitui foto existente; remove arquivo antigo se houver */
export function replaceStudentPhoto(studentId, previousRelPath, file) {
  const rel = finalizeNewStudentPhoto(studentId, file);
  if (previousRelPath && previousRelPath !== rel) {
    deleteStudentPhotoFile(previousRelPath);
  }
  return rel;
}

export function maybeStudentPhotoUpload(req, res, next) {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('multipart/form-data')) {
    return studentPhotoUpload.single('photo')(req, res, next);
  }
  next();
}