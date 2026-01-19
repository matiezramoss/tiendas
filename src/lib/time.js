// PATH: src/lib/time.js

function toMin(hhmm) {
  const s = String(hhmm || "").trim();
  const [hh, mm] = s.split(":").map((x) => Number(x));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function nowMin() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// rango normal: desde <= hasta  (ej 05:00 a 20:00)
// rango overnight: desde > hasta (ej 20:00 a 01:00) => (>=desde) OR (<=hasta)
function isInRange(min, desde, hasta) {
  const d = toMin(desde);
  const h = toMin(hasta);
  if (d == null || h == null) return true; // si está mal cargado, no bloqueamos
  if (d <= h) return min >= d && min <= h;
  return min >= d || min <= h;
}

/**
 * horarios esperado:
 * tienda.horarios = {
 *   cafeteria: { desde:"05:00", hasta:"20:00" },
 *   comida:    { desde:"20:00", hasta:"01:00" }
 * }
 */
export function isDisponibleParaTags(tags = [], horarios = {}) {
  const t = Array.isArray(tags) ? tags : [];
  if (t.length === 0) return true;

  const m = nowMin();

  // Si el producto tiene varios tags, lo consideramos disponible si ALGUNO está en horario.
  for (const tag of t) {
    const conf = horarios?.[tag];
    if (!conf) continue; // tag sin config => no decide
    if (isInRange(m, conf?.desde, conf?.hasta)) return true;
  }

  // Si había tags pero ninguno tiene config en tienda, no bloqueamos.
  const algunoConConfig = t.some((tag) => horarios?.[tag]);
  if (!algunoConConfig) return true;

  // Había tags con config pero ninguno en rango => bloqueado
  return false;
}

export function isProductoDisponibleAhora(producto, tienda) {
  if (!producto) return false;

  // respeta el flag del producto
  if (producto.disponible === false) return false;

  const tags = producto.tagsHorario || [];
  const horarios = tienda?.horarios || tienda?.branding?.horarios || {}; // por si lo tenías en otro lado
  return isDisponibleParaTags(tags, horarios);
}
