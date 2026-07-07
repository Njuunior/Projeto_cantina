-- ============================================================
-- Sistema de Controle de Consumo Escolar (PostgreSQL)
-- Usuário sugerido: postgres
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Administradores (área /admin)
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(80) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alunos
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  class_name VARCHAR(100) NOT NULL,
  guardian_name VARCHAR(200) NOT NULL,
  guardian_relationship VARCHAR(80),
  guardian_document VARCHAR(30),
  guardian_contact VARCHAR(40),
  guardian_whatsapp VARCHAR(40),
  whatsapp_opt_in BOOLEAN NOT NULL DEFAULT TRUE,
  rfid_uid VARCHAR(64) UNIQUE NOT NULL,
  balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  credit_limit_max_cents INTEGER NOT NULL DEFAULT 5000 CHECK (credit_limit_max_cents >= 0),
  limit_used_cents INTEGER NOT NULL DEFAULT 0 CHECK (limit_used_cents >= 0),
  photo_path VARCHAR(512),
  CONSTRAINT chk_limit_used_vs_max CHECK (limit_used_cents <= credit_limit_max_cents),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_rfid ON students (rfid_uid);
CREATE INDEX IF NOT EXISTS idx_students_class ON students (class_name);

-- Professores (expansão futura)
CREATE TABLE IF NOT EXISTS teachers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  discipline VARCHAR(150),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Produtos da cantina
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_active ON products (active);

-- Consumos (saldo primeiro, depois limite na mesma venda)
CREATE TABLE IF NOT EXISTS consumptions (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE RESTRICT,
  product_id INTEGER NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents > 0),
  total_cents INTEGER NOT NULL CHECK (total_cents > 0),
  paid_from_balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (paid_from_balance_cents >= 0),
  paid_from_limit_cents INTEGER NOT NULL DEFAULT 0 CHECK (paid_from_limit_cents >= 0),
  registered_by VARCHAR(20) NOT NULL DEFAULT 'rfid' CHECK (registered_by IN ('rfid', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_consumption_split CHECK (
    paid_from_balance_cents + paid_from_limit_cents = total_cents
  )
);

CREATE INDEX IF NOT EXISTS idx_consumptions_student ON consumptions (student_id);
CREATE INDEX IF NOT EXISTS idx_consumptions_created ON consumptions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consumptions_product ON consumptions (product_id);

-- Créditos pré-pagos (lançamentos manuais pelo admin)
CREATE TABLE IF NOT EXISTS credit_topups (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  note TEXT,
  admin_id INTEGER REFERENCES admins (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_topups_student ON credit_topups (student_id);

-- Pagamentos que quitam uso do limite (NÃO viram saldo)
CREATE TABLE IF NOT EXISTS limit_payments (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  note TEXT,
  admin_id INTEGER REFERENCES admins (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_limit_payments_student ON limit_payments (student_id);

-- Atualiza updated_at em students
CREATE OR REPLACE FUNCTION set_updated_at_students()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_students_updated_at ON students;
CREATE TRIGGER tr_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at_students();

-- Visão: resumo financeiro por aluno (DROP evita erro ao mudar colunas em bancos já existentes)
DROP VIEW IF EXISTS v_student_finance;
CREATE VIEW v_student_finance AS
SELECT
  s.id,
  s.name,
  s.class_name,
  s.guardian_name,
  s.rfid_uid,
  s.balance_cents,
  s.credit_limit_max_cents,
  s.limit_used_cents,
  (s.credit_limit_max_cents - s.limit_used_cents) AS limit_available_cents,
  CASE
    WHEN s.credit_limit_max_cents > 0
      AND (s.credit_limit_max_cents - s.limit_used_cents)::numeric / s.credit_limit_max_cents <= 0.2
    THEN TRUE
    ELSE FALSE
  END AS limit_near_exhausted
FROM students s;

-- Visão: extrato unificado (para relatórios agregados; extrato detalhado montado na API)
CREATE OR REPLACE VIEW v_ledger_summary AS
SELECT 'credit_topup' AS entry_type, id, student_id, amount_cents AS signed_amount, created_at
FROM credit_topups
UNION ALL
SELECT 'consumption', id, student_id, -total_cents, created_at
FROM consumptions
UNION ALL
SELECT 'limit_payment', id, student_id, amount_cents, created_at
FROM limit_payments;

COMMENT ON TABLE students IS 'Alunos: saldo pré-pago e limite pós-pago (limit_used = dívida no limite).';
COMMENT ON COLUMN students.limit_used_cents IS 'Valor já consumido no limite (dívida a quitar com limit_payments).';
COMMENT ON TABLE limit_payments IS 'Quita dívida do limite; não incrementa balance_cents.';
