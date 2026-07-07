export function brl(cents) {
  const n = Number(cents) || 0;
  return (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function parseBRLToCents(str) {
  if (str == null || str === '') return NaN;
  const cleaned = String(str).replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.');
  const v = Number.parseFloat(cleaned);
  if (Number.isNaN(v)) return NaN;
  return Math.round(v * 100);
}
