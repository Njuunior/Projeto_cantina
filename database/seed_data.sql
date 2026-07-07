-- Dados de demonstração (execute após schema.sql)
-- Admin é criado via script Node (hash bcrypt)

INSERT INTO products (name, price_cents, active)
SELECT * FROM (VALUES
  ('Refrigerante 350ml', 450, TRUE),
  ('Suco natural 300ml', 350, TRUE),
  ('Sanduíche natural', 800, TRUE),
  ('Pão de queijo (6 un)', 600, TRUE),
  ('Água 500ml', 250, TRUE),
  ('Chocolate', 400, TRUE),
  ('Salgado assado', 500, TRUE)
) AS v(name, price_cents, active)
WHERE NOT EXISTS (SELECT 1 FROM products LIMIT 1);

-- RFID de exemplo (ajuste conforme cartões reais)
INSERT INTO students (name, class_name, guardian_name, rfid_uid, balance_cents, credit_limit_max_cents, limit_used_cents) VALUES
  ('Ana Carolina Silva', '3º A', 'Maria Silva (mãe)', 'RFID0001A1B2C3', 1500, 5000, 0),
  ('Bruno Oliveira Costa', '2º B', 'João Costa (pai)', 'RFID0002D4E5F6', 0, 5000, 1200),
  ('Carla Mendes Souza', '1º C', 'Patricia Souza', 'RFID0003G7H8I9', 200, 5000, 4800),
  ('Daniel Pereira Lima', '3º B', 'Roberto Lima', 'RFID0004J0K1L2', 5000, 3000, 0)
ON CONFLICT (rfid_uid) DO NOTHING;

INSERT INTO teachers (name, discipline)
SELECT 'Prof. Ricardo Alves', 'Matemática'
WHERE NOT EXISTS (SELECT 1 FROM teachers WHERE name = 'Prof. Ricardo Alves');

INSERT INTO teachers (name, discipline)
SELECT 'Profa. Fernanda Dias', 'Português'
WHERE NOT EXISTS (SELECT 1 FROM teachers WHERE name = 'Profa. Fernanda Dias');
