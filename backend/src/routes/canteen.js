import { Router } from 'express';
import { pool } from '../db/pool.js';
import { normalizeRfidUid } from '../util/rfid.js';
import { serializeStudent, serializeProduct } from '../util/serialize.js';
import { computeConsumption } from '../services/consumptionService.js';
import { sendPurchaseNotificationWhatsapp } from '../services/whatsappService.js';

export const canteenRouter = Router();

canteenRouter.get('/products', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM products WHERE active = TRUE ORDER BY name'
  );
  res.json(rows.map(serializeProduct));
});

canteenRouter.get('/student-by-rfid/:uid', async (req, res) => {
  const uid = normalizeRfidUid(req.params.uid);
  if (!uid) return res.status(400).json({ error: 'RFID inválido' });
  const { rows } = await pool.query('SELECT * FROM students WHERE rfid_uid = $1', [uid]);
  const s = rows[0];
  if (!s) return res.status(404).json({ error: 'Cartão não cadastrado' });
  res.json(serializeStudent(s));
});

canteenRouter.post('/consume', async (req, res) => {
  const { rfidUid, productId, quantity = 1, registeredBy = 'rfid' } = req.body || {};
  const uid = normalizeRfidUid(rfidUid);
  const pid = Number(productId);
  const qty = Math.max(1, Math.min(99, Number(quantity) || 1));
  const reg = registeredBy === 'manual' ? 'manual' : 'rfid';

  if (!uid || !Number.isInteger(pid)) {
    return res.status(400).json({ error: 'rfidUid e productId são obrigatórios' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pr = await client.query('SELECT * FROM products WHERE id = $1 AND active = TRUE FOR SHARE', [
      pid,
    ]);
    const product = pr.rows[0];
    if (!product) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Produto não encontrado ou inativo' });
    }

    const sr = await client.query('SELECT * FROM students WHERE rfid_uid = $1 FOR UPDATE', [uid]);
    const student = sr.rows[0];
    if (!student) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Aluno não encontrado' });
    }

    const unit = product.price_cents;
    const totalCents = unit * qty;

    let plan;
    try {
      plan = computeConsumption(student, totalCents);
    } catch (e) {
      if (e.code === 'LIMIT_EXCEEDED') {
        await client.query('ROLLBACK');
        return res.status(403).json({
          error: 'Limite de crédito insuficiente para este consumo',
          code: 'LIMIT_EXCEEDED',
          details: e.details,
          student: serializeStudent(student),
        });
      }
      throw e;
    }

    await client.query(
      `UPDATE students SET balance_cents = $1, limit_used_cents = $2 WHERE id = $3`,
      [plan.newBalance, plan.newLimitUsed, student.id]
    );

    const ins = await client.query(
      `INSERT INTO consumptions (
        student_id, product_id, quantity, unit_price_cents, total_cents,
        paid_from_balance_cents, paid_from_limit_cents, registered_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [
        student.id,
        pid,
        qty,
        unit,
        totalCents,
        plan.fromBalance,
        plan.fromLimit,
        reg,
      ]
    );

    await client.query('COMMIT');

    const updated = await pool.query('SELECT * FROM students WHERE id = $1', [student.id]);
    const updatedStudent = serializeStudent(updated.rows[0]);
    const daily = await pool.query(
      `SELECT COALESCE(SUM(total_cents),0)::int AS spent_cents
       FROM consumptions
       WHERE student_id = $1
         AND created_at >= date_trunc('day', now())`,
      [student.id]
    );
    sendPurchaseNotificationWhatsapp({
      student: updatedStudent,
      lines: [{ productName: product.name, quantity: qty, lineTotalCents: totalCents }],
      totalCents,
      summary: {
        spentTodayCents: daily.rows[0].spent_cents,
        balanceCents: updated.rows[0].balance_cents,
        limitUsedCents: updated.rows[0].limit_used_cents,
      },
    }).catch((e) => console.error('Falha WhatsApp:', e.message));

    res.json({
      ok: true,
      consumption: ins.rows[0],
      student: updatedStudent,
      product: serializeProduct(product),
      alerts: plan.alerts,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Erro ao registrar consumo' });
  } finally {
    client.release();
  }
});

/** Carrinho: vários itens em uma transação; um único aviso ao responsável. */
canteenRouter.post('/checkout', async (req, res) => {
  const { rfidUid, items, registeredBy = 'rfid' } = req.body || {};
  const uid = normalizeRfidUid(rfidUid);
  const reg = registeredBy === 'manual' ? 'manual' : 'rfid';

  if (!uid || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Informe o RFID e ao menos um item no carrinho' });
  }

  const normalized = [];
  for (const it of items) {
    const pid = Number(it.productId);
    const q = Math.max(1, Math.min(99, Number(it.quantity) || 1));
    if (!Number.isInteger(pid)) {
      return res.status(400).json({ error: 'Cada item precisa de productId válido' });
    }
    normalized.push({ productId: pid, quantity: q });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sr = await client.query('SELECT * FROM students WHERE rfid_uid = $1 FOR UPDATE', [uid]);
    const student = sr.rows[0];
    if (!student) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Aluno não encontrado' });
    }

    const lines = [];
    let totalCart = 0;
    for (const { productId, quantity } of normalized) {
      const pr = await client.query(
        'SELECT * FROM products WHERE id = $1 AND active = TRUE FOR SHARE',
        [productId]
      );
      const product = pr.rows[0];
      if (!product) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Produto não encontrado ou inativo' });
      }
      const lineTotal = product.price_cents * quantity;
      totalCart += lineTotal;
      lines.push({
        productId,
        productName: product.name,
        quantity,
        unitPriceCents: product.price_cents,
        totalCents: lineTotal,
      });
    }

    let plan;
    try {
      plan = computeConsumption(student, totalCart);
    } catch (e) {
      if (e.code === 'LIMIT_EXCEEDED') {
        await client.query('ROLLBACK');
        return res.status(403).json({
          error: 'Limite de crédito insuficiente para esta compra',
          code: 'LIMIT_EXCEEDED',
          details: e.details,
          student: serializeStudent(student),
        });
      }
      throw e;
    }

    let poolB = plan.fromBalance;
    let poolL = plan.fromLimit;
    const consumptions = [];

    for (const line of lines) {
      const T = line.totalCents;
      const pb = Math.min(T, poolB);
      const pl = T - pb;
      poolB -= pb;
      poolL -= pl;

      const ins = await client.query(
        `INSERT INTO consumptions (
          student_id, product_id, quantity, unit_price_cents, total_cents,
          paid_from_balance_cents, paid_from_limit_cents, registered_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *`,
        [
          student.id,
          line.productId,
          line.quantity,
          line.unitPriceCents,
          line.totalCents,
          pb,
          pl,
          reg,
        ]
      );
      consumptions.push(ins.rows[0]);
    }

    if (poolB !== 0 || poolL !== 0) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: 'Falha na divisão saldo/limite' });
    }

    await client.query(
      `UPDATE students SET balance_cents = $1, limit_used_cents = $2 WHERE id = $3`,
      [plan.newBalance, plan.newLimitUsed, student.id]
    );

    await client.query('COMMIT');

    const updated = await pool.query('SELECT * FROM students WHERE id = $1', [student.id]);
    const updatedStudent = serializeStudent(updated.rows[0]);
    const daily = await pool.query(
      `SELECT COALESCE(SUM(total_cents),0)::int AS spent_cents
       FROM consumptions
       WHERE student_id = $1
         AND created_at >= date_trunc('day', now())`,
      [student.id]
    );

    sendPurchaseNotificationWhatsapp({
      student: updatedStudent,
      lines: lines.map((l) => ({
        productName: l.productName,
        quantity: l.quantity,
        lineTotalCents: l.totalCents,
      })),
      totalCents: totalCart,
      summary: {
        spentTodayCents: daily.rows[0].spent_cents,
        balanceCents: updated.rows[0].balance_cents,
        limitUsedCents: updated.rows[0].limit_used_cents,
      },
    }).catch((e) => console.error('Falha WhatsApp:', e.message));

    res.json({
      ok: true,
      totalCents: totalCart,
      consumptions,
      student: updatedStudent,
      lines: lines.map((l) => ({
        productId: l.productId,
        productName: l.productName,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
        totalCents: l.totalCents,
      })),
      alerts: plan.alerts,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Erro ao finalizar compra' });
  } finally {
    client.release();
  }
});
