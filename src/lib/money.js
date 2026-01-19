// PATH: src/lib/money.js
export function money(n) {
  const v = Number(n || 0);
  return new Intl.NumberFormat("es-AR").format(v);
}
