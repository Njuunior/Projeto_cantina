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

-- RFID de exemplo removido — cadastre alunos reais pelo admin com cartão físico.

INSERT INTO teachers (name, discipline)
SELECT 'Prof. Ricardo Alves', 'Matemática'
WHERE NOT EXISTS (SELECT 1 FROM teachers WHERE name = 'Prof. Ricardo Alves');

INSERT INTO teachers (name, discipline)
SELECT 'Profa. Fernanda Dias', 'Português'
WHERE NOT EXISTS (SELECT 1 FROM teachers WHERE name = 'Profa. Fernanda Dias');
