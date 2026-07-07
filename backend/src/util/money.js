export function parseMoneyToCents(input) {
  if (typeof input === 'number' && Number.isInteger(input)) return input;
  if (typeof input !== 'string') return NaN;
  const n = input.replace(/\s/g, '').replace(',', '.');
  const v = Number.parseFloat(n);
  if (Number.isNaN(v)) return NaN;
  return Math.round(v * 100);
}

export function centsToDisplay(cents) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
