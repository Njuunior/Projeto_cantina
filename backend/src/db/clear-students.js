/**
 * Remove TODOS os alunos e dados ligados a eles (consumos, créditos, quitações, fotos).
 * Não altera produtos, admins, professores nem outras tabelas.
 */
import dotenv from 'dotenv';
import pg from 'pg';
import { deleteStudentPhotoFile } from '../middleware/studentPhotoUpload.js';

dotenv.config();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Defina DATABASE_URL no backend/.env');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const { rows: students } = await client.query(
      'SELECT id, name, photo_path FROM students ORDER BY id'
    );

    if (!students.length) {
      console.log('Nenhum aluno no banco.');
      return;
    }

    console.log(`Encontrados ${students.length} aluno(s). Apagando...`);

    await client.query('BEGIN');

    const consumptions = await client.query('DELETE FROM consumptions RETURNING id');
    const topups = await client.query('DELETE FROM credit_topups RETURNING id');
    const payments = await client.query('DELETE FROM limit_payments RETURNING id');
    const removed = await client.query('DELETE FROM students RETURNING id');

    await client.query('ALTER SEQUENCE students_id_seq RESTART WITH 1');
    await client.query('COMMIT');

    for (const s of students) {
      if (s.photo_path) deleteStudentPhotoFile(s.photo_path);
    }

    console.log(`  Consumos removidos: ${consumptions.rowCount}`);
    console.log(`  Créditos removidos: ${topups.rowCount}`);
    console.log(`  Quitações removidas: ${payments.rowCount}`);
    console.log(`  Alunos removidos: ${removed.rowCount}`);
    console.log('Pronto. Produtos, admins e demais dados foram mantidos.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
