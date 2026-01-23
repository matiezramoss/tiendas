// PATH: src/lib/delivery.js

// ✅ Editá acá los barrios y precios (sin tocar Firestore)
export const BARRIOS = [
  { key: "barrio1", nombre: "Barrio 1", precio: 1000 },
  { key: "barrio2", nombre: "Barrio 2", precio: 1200 },
  { key: "barrio3", nombre: "Barrio 3", precio: 1500 },
  { key: "barrio4", nombre: "Barrio 4", precio: 1700 },
  { key: "barrio5", nombre: "Barrio 5", precio: 2000 },
];

export function getBarrioByKey(key) {
  const k = String(key || "").trim();
  return BARRIOS.find((b) => b.key === k) || null;
}

export function calcEnvioFromBarrioKey(key) {
  const b = getBarrioByKey(key);
  return b ? Number(b.precio || 0) : 0;
}
