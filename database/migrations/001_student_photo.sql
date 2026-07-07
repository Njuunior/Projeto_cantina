-- Fotos de alunos (caminho relativo dentro da pasta uploads/, ex.: students/student-1.jpg)
ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_path VARCHAR(512);

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
  s.photo_path,
  CASE
    WHEN s.credit_limit_max_cents > 0
      AND (s.credit_limit_max_cents - s.limit_used_cents)::numeric / s.credit_limit_max_cents <= 0.2
    THEN TRUE
    ELSE FALSE
  END AS limit_near_exhausted
FROM students s;
