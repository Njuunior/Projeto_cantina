import fs from 'fs';
import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';
import { serializeStudent, serializeProduct } from '../util/serialize.js';
import { parseMoneyToCents } from '../util/money.js';
import { normalizeRfidUid } from '../util/rfid.js';
import {
  maybeStudentPhotoUpload,
  studentPhotoUpload,
  finalizeNewStudentPhoto,
  replaceStudentPhoto,
} from '../middleware/studentPhotoUpload.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

const PREDEFINED_CLASSES = [
  '1º A',
  '1º B',
  '1º C',
  '2º A',
  '2º B',
  '2º C',
  '3º A',
  '3º B',
  '3º C',
];

/** Alunos */
adminRouter.get('/students', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM students ORDER BY class_name ASC, name ASC'
  );
  res.json(rows.map(serializeStudent));
});

adminRouter.get('/class-options', async (_req, res) => {
  res.json(PREDEFINED_CLASSES);
});

adminRouter.post('/students', maybeStudentPhotoUpload, async (req, res) => {
  const body = req.body || {};
  const name = (body.name != null ? String(body.name) : '').trim();
  const className = (body.className != null ? String(body.className) : '').trim();
  const guardianName = (body.guardianName != null ? String(body.guardianName) : '').trim();
  const guardianRelationship = (body.guardianRelationship != null ? String(body.guardianRelationship) : '').trim();
  const guardianDocument = (body.guardianDocument != null ? String(body.guardianDocument) : '').trim();
  const guardianContact = (body.guardianContact != null ? String(body.guardianContact) : '').trim();
  const guardianWhatsappRaw = body.guardianWhatsapp != null ? String(body.guardianWhatsapp).trim() : '';
  const guardianWhatsapp = guardianWhatsappRaw || guardianContact;
  const whatsappOptIn =
    body.whatsappOptIn == null ? true : ['true', '1', 'on', 'yes'].includes(String(body.whatsappOptIn).toLowerCase());
  const rfidUid = normalizeRfidUid(body.rfidUid);

  let balanceCents = Number.parseInt(body.balanceCents, 10);
  if (Number.isNaN(balanceCents) || balanceCents < 0) balanceCents = 0;
  let creditLimitMaxCents = Number.parseInt(body.creditLimitMaxCents, 10);
  if (Number.isNaN(creditLimitMaxCents) || creditLimitMaxCents < 0) creditLimitMaxCents = 5000;

  if (
    !name ||
    !className ||
    !guardianName ||
    !guardianRelationship ||
    !guardianDocument ||
    !guardianContact ||
    !rfidUid
  ) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
    }
    return res
      .status(400)
      .json({ error: 'Campos obrigatórios: nome, turma, responsável, parentesco, documento, contato e RFID' });
  }

  if (!PREDEFINED_CLASSES.includes(className)) {
    return res.status(400).json({ error: 'Turma inválida. Use uma turma predefinida.' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO students (
        name, class_name, guardian_name, guardian_relationship, guardian_document, guardian_contact, guardian_whatsapp,
        whatsapp_opt_in, rfid_uid, balance_cents, credit_limit_max_cents, limit_used_cents
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0) RETURNING *`,
      [
        name,
        className,
        guardianName,
        guardianRelationship,
        guardianDocument,
        guardianContact,
        guardianWhatsapp,
        whatsappOptIn,
        rfidUid,
        balanceCents,
        creditLimitMaxCents,
      ]
    );
    const studentId = rows[0].id;

    if (req.file) {
      try {
        const rel = finalizeNewStudentPhoto(studentId, req.file);
        await pool.query('UPDATE students SET photo_path = $1 WHERE id = $2', [rel, studentId]);
      } catch (e) {
        console.error(e);
      }
    }

    const { rows: full } = await pool.query('SELECT * FROM students WHERE id = $1', [studentId]);
    res.status(201).json(serializeStudent(full[0]));
  } catch (e) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
    }
    if (e.code === '23505') {
      return res.status(409).json({ error: 'RFID já cadastrado' });
    }
    throw e;
  }
});

adminRouter.patch(
  '/students/:id/photo',
  studentPhotoUpload.single('photo'),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!req.file) {
      return res.status(400).json({ error: 'Envie uma imagem no campo photo' });
    }
    try {
      const cur = await pool.query('SELECT * FROM students WHERE id = $1', [id]);
      if (!cur.rows[0]) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Aluno não encontrado' });
      }
      const rel = replaceStudentPhoto(id, cur.rows[0].photo_path, req.file);
      await pool.query('UPDATE students SET photo_path = $1 WHERE id = $2', [rel, id]);
      const { rows } = await pool.query('SELECT * FROM students WHERE id = $1', [id]);
      res.json(serializeStudent(rows[0]));
    } catch (e) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          /* ignore */
        }
      }
      throw e;
    }
  }
);

adminRouter.patch('/students/:id', async (req, res) => {
  const id = Number(req.params.id);
  const {
    name,
    className,
    guardianName,
    guardianRelationship,
    guardianDocument,
    guardianContact,
    guardianWhatsapp,
    whatsappOptIn,
    rfidUid,
  } = req.body || {};
  const fields = [];
  const vals = [];
  let i = 1;
  if (name != null) {
    fields.push(`name = $${i++}`);
    vals.push(String(name).trim());
  }
  if (className != null) {
    if (!PREDEFINED_CLASSES.includes(String(className).trim())) {
      return res.status(400).json({ error: 'Turma inválida. Use uma turma predefinida.' });
    }
    fields.push(`class_name = $${i++}`);
    vals.push(String(className).trim());
  }
  if (guardianName != null) {
    fields.push(`guardian_name = $${i++}`);
    vals.push(String(guardianName).trim());
  }
  if (rfidUid != null) {
    const normalized = normalizeRfidUid(rfidUid);
    if (!normalized) {
      return res.status(400).json({ error: 'RFID é obrigatório' });
    }
    fields.push(`rfid_uid = $${i++}`);
    vals.push(normalized);
  }
  if (guardianRelationship != null) {
    fields.push(`guardian_relationship = $${i++}`);
    vals.push(String(guardianRelationship).trim());
  }
  if (guardianDocument != null) {
    fields.push(`guardian_document = $${i++}`);
    vals.push(String(guardianDocument).trim());
  }
  if (guardianContact != null) {
    fields.push(`guardian_contact = $${i++}`);
    vals.push(String(guardianContact).trim());
  }
  if (guardianWhatsapp != null) {
    fields.push(`guardian_whatsapp = $${i++}`);
    vals.push(String(guardianWhatsapp).trim());
  }
  if (whatsappOptIn != null) {
    const parsed = ['true', '1', 'on', 'yes'].includes(String(whatsappOptIn).toLowerCase());
    fields.push(`whatsapp_opt_in = $${i++}`);
    vals.push(parsed);
  }
  if (!fields.length) {
    return res.status(400).json({ error: 'Nada para atualizar' });
  }
  vals.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE students SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'Aluno não encontrado' });
    res.json(serializeStudent(rows[0]));
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'RFID já cadastrado' });
    }
    throw e;
  }
});

adminRouter.patch('/students/:id/limit-max', async (req, res) => {
  const id = Number(req.params.id);
  const max = Number(req.body?.creditLimitMaxCents);
  if (!Number.isInteger(max) || max < 0) {
    return res.status(400).json({ error: 'creditLimitMaxCents inválido' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sr = await client.query('SELECT * FROM students WHERE id = $1 FOR UPDATE', [id]);
    const s = sr.rows[0];
    if (!s) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Aluno não encontrado' });
    }
    if (max < s.limit_used_cents) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'O teto do limite não pode ser menor que o limite já utilizado (dívida atual). Quite parte da dívida primeiro.',
        limitUsedCents: s.limit_used_cents,
      });
    }
    await client.query(
      'UPDATE students SET credit_limit_max_cents = $1 WHERE id = $2',
      [max, id]
    );
    await client.query('COMMIT');
    const { rows } = await pool.query('SELECT * FROM students WHERE id = $1', [id]);
    res.json(serializeStudent(rows[0]));
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

/** Créditos (saldo) */
adminRouter.post('/credits', async (req, res) => {
  const studentId = Number(req.body?.studentId);
  let amountCents = req.body?.amountCents;
  if (amountCents == null && req.body?.amountBRL != null) {
    amountCents = parseMoneyToCents(String(req.body.amountBRL));
  } else {
    amountCents = Number(amountCents);
  }
  const note = req.body?.note || null;
  if (!Number.isInteger(studentId) || !Number.isInteger(amountCents) || amountCents <= 0) {
    return res.status(400).json({ error: 'studentId e valor positivo em centavos (ou amountBRL) são obrigatórios' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sr = await client.query('SELECT * FROM students WHERE id = $1 FOR UPDATE', [studentId]);
    if (!sr.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Aluno não encontrado' });
    }
    const s = sr.rows[0];
    const newBal = s.balance_cents + amountCents;
    await client.query('UPDATE students SET balance_cents = $1 WHERE id = $2', [newBal, studentId]);
    await client.query(
      `INSERT INTO credit_topups (student_id, amount_cents, note, admin_id) VALUES ($1,$2,$3,$4)`,
      [studentId, amountCents, note, req.admin.id]
    );
    await client.query('COMMIT');
    const { rows } = await pool.query('SELECT * FROM students WHERE id = $1', [studentId]);
    res.status(201).json({ student: serializeStudent(rows[0]), amountCents });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

/** Quitar limite (não vira saldo) */
adminRouter.post('/limit-payments', async (req, res) => {
  const studentId = Number(req.body?.studentId);
  let amountCents = req.body?.amountCents;
  if (amountCents == null && req.body?.amountBRL != null) {
    amountCents = parseMoneyToCents(String(req.body.amountBRL));
  } else {
    amountCents = Number(amountCents);
  }
  const note = req.body?.note || null;
  if (!Number.isInteger(studentId) || !Number.isInteger(amountCents) || amountCents <= 0) {
    return res.status(400).json({ error: 'studentId e valor positivo obrigatórios' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sr = await client.query('SELECT * FROM students WHERE id = $1 FOR UPDATE', [studentId]);
    if (!sr.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Aluno não encontrado' });
    }
    const s = sr.rows[0];
    if (amountCents > s.limit_used_cents) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Valor maior que a dívida atual no limite',
        limitUsedCents: s.limit_used_cents,
      });
    }
    const newUsed = s.limit_used_cents - amountCents;
    await client.query('UPDATE students SET limit_used_cents = $1 WHERE id = $2', [newUsed, studentId]);
    await client.query(
      `INSERT INTO limit_payments (student_id, amount_cents, note, admin_id) VALUES ($1,$2,$3,$4)`,
      [studentId, amountCents, note, req.admin.id]
    );
    await client.query('COMMIT');
    const { rows } = await pool.query('SELECT * FROM students WHERE id = $1', [studentId]);
    res.status(201).json({ student: serializeStudent(rows[0]), amountCents });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

/** Produtos */
adminRouter.get('/products', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM products ORDER BY name');
  res.json(rows.map(serializeProduct));
});

adminRouter.post('/products', async (req, res) => {
  const { name, priceCents, active = true } = req.body || {};
  let pc = priceCents;
  if (pc == null && req.body?.priceBRL != null) {
    pc = parseMoneyToCents(String(req.body.priceBRL));
  } else {
    pc = Number(pc);
  }
  if (!name || !Number.isInteger(pc) || pc <= 0) {
    return res.status(400).json({ error: 'Nome e preço válidos obrigatórios' });
  }
  const { rows } = await pool.query(
    `INSERT INTO products (name, price_cents, active) VALUES ($1,$2,$3) RETURNING *`,
    [String(name).trim(), pc, !!active]
  );
  res.status(201).json(serializeProduct(rows[0]));
});

adminRouter.patch('/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name, active } = req.body || {};
  let pc;
  if (req.body?.priceCents != null) pc = Number(req.body.priceCents);
  if (req.body?.priceBRL != null) pc = parseMoneyToCents(String(req.body.priceBRL));

  const fields = [];
  const vals = [];
  let i = 1;
  if (name != null) {
    fields.push(`name = $${i++}`);
    vals.push(String(name).trim());
  }
  if (pc != null) {
    if (!Number.isInteger(pc) || pc <= 0) {
      return res.status(400).json({ error: 'Preço inválido' });
    }
    fields.push(`price_cents = $${i++}`);
    vals.push(pc);
  }
  if (active != null) {
    fields.push(`active = $${i++}`);
    vals.push(!!active);
  }
  if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar' });
  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE products SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  );
  if (!rows[0]) return res.status(404).json({ error: 'Produto não encontrado' });
  res.json(serializeProduct(rows[0]));
});

/** Professores */
adminRouter.get('/teachers', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM teachers ORDER BY name');
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      discipline: r.discipline,
      createdAt: r.created_at,
    }))
  );
});

adminRouter.post('/teachers', async (req, res) => {
  const { name, discipline } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
  const { rows } = await pool.query(
    `INSERT INTO teachers (name, discipline) VALUES ($1,$2) RETURNING *`,
    [String(name).trim(), discipline ? String(discipline).trim() : null]
  );
  res.status(201).json({
    id: rows[0].id,
    name: rows[0].name,
    discipline: rows[0].discipline,
  });
});

/** Extrato */
adminRouter.get('/students/:id/statement', async (req, res) => {
  const id = Number(req.params.id);
  const { rows: srows } = await pool.query('SELECT * FROM students WHERE id = $1', [id]);
  if (!srows[0]) return res.status(404).json({ error: 'Aluno não encontrado' });

  const credits = await pool.query(
    `SELECT id, amount_cents, note, created_at FROM credit_topups WHERE student_id = $1 ORDER BY created_at DESC`,
    [id]
  );
  const consumptions = await pool.query(
    `SELECT c.*, p.name AS product_name FROM consumptions c
     JOIN products p ON p.id = c.product_id
     WHERE c.student_id = $1 ORDER BY c.created_at DESC`,
    [id]
  );
  const limPay = await pool.query(
    `SELECT id, amount_cents, note, created_at FROM limit_payments WHERE student_id = $1 ORDER BY created_at DESC`,
    [id]
  );

  const entries = [];

  for (const r of credits.rows) {
    entries.push({
      kind: 'credit_topup',
      id: r.id,
      at: r.created_at,
      amountCents: r.amount_cents,
      note: r.note,
      label: 'Crédito adicionado',
    });
  }
  for (const r of consumptions.rows) {
    entries.push({
      kind: 'consumption',
      id: r.id,
      at: r.created_at,
      amountCents: -r.total_cents,
      productName: r.product_name,
      quantity: r.quantity,
      paidFromBalanceCents: r.paid_from_balance_cents,
      paidFromLimitCents: r.paid_from_limit_cents,
      registeredBy: r.registered_by,
      label: `Consumo: ${r.product_name}`,
    });
  }
  for (const r of limPay.rows) {
    entries.push({
      kind: 'limit_payment',
      id: r.id,
      at: r.created_at,
      amountCents: r.amount_cents,
      note: r.note,
      label: 'Pagamento do limite (quitação)',
    });
  }

  entries.sort((a, b) => new Date(b.at) - new Date(a.at));

  res.json({
    student: serializeStudent(srows[0]),
    entries,
  });
});

/** Relatórios */
adminRouter.get('/reports/consumption-by-student', async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT s.id, s.name, s.class_name,
           COALESCE(SUM(c.total_cents), 0)::int AS total_spent_cents,
           COUNT(c.id)::int AS purchase_count
    FROM students s
    LEFT JOIN consumptions c ON c.student_id = s.id
    GROUP BY s.id, s.name, s.class_name
    ORDER BY total_spent_cents DESC
  `);
  res.json(rows);
});

adminRouter.get('/reports/zero-balance', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM students WHERE balance_cents = 0 ORDER BY name`
  );
  res.json(rows.map(serializeStudent));
});

adminRouter.get('/reports/using-limit', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM students WHERE limit_used_cents > 0 ORDER BY limit_used_cents DESC`
  );
  res.json(rows.map(serializeStudent));
});

adminRouter.get('/reports/limit-blocked', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM students
     WHERE credit_limit_max_cents > 0 AND limit_used_cents >= credit_limit_max_cents
     ORDER BY name`
  );
  res.json(rows.map(serializeStudent));
});

adminRouter.get('/reports/total-sales', async (req, res) => {
  const from = req.query.from;
  const to = req.query.to;
  let q = `SELECT COALESCE(SUM(total_cents),0)::int AS total_cents, COUNT(*)::int AS count FROM consumptions WHERE 1=1`;
  const p = [];
  if (from) {
    p.push(from);
    q += ` AND created_at >= $${p.length}::timestamptz`;
  }
  if (to) {
    p.push(to);
    q += ` AND created_at <= $${p.length}::timestamptz`;
  }
  const { rows } = await pool.query(q, p);
  res.json(rows[0]);
});
