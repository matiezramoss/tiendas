// PATH: src/lib/delivery.js

// ✅ Editá acá los barrios y precios (sin tocar Firestore)
export const BARRIOS = [
  { key: "centro", nombre: "Centro", precio: 2000 },
  { key: "martin", nombre: "Martin", precio: 0 },
  { key: "abasto", nombre: "Abasto", precio: 0 },
  { key: "pichincha", nombre: "Pichincha", precio: 0 },
  { key: "luis-agote", nombre: "Luis Agote", precio: 0 },
  { key: "lourdes", nombre: "Lourdes", precio: 0 },
  { key: "republica-de-la-sexta", nombre: "República de la Sexta", precio: 0 },
  { key: "espana-y-hospitales", nombre: "España y Hospitales", precio: 0 },
  { key: "echesortu", nombre: "Echesortu", precio: 0 },
  { key: "alberdi", nombre: "Alberdi", precio: 0 },
  { key: "arroyito", nombre: "Arroyito", precio: 0 },
  { key: "la-florida", nombre: "La Florida", precio: 0 },
  { key: "refineria", nombre: "Refinería", precio: 0 },
  { key: "rucci", nombre: "Rucci", precio: 0 },
  { key: "parque-field", nombre: "Parque Field", precio: 0 },
  { key: "cristaleria", nombre: "Cristalería", precio: 0 },
  { key: "la-ceramica", nombre: "La Cerámica", precio: 0 },
  { key: "fisherton", nombre: "Fisherton", precio: 0 },
  { key: "belgrano", nombre: "Belgrano", precio: 0 },
  { key: "azcuenaga", nombre: "Azcuénaga", precio: 0 },
  { key: "empalme-graneros", nombre: "Empalme Graneros", precio: 0 },
  { key: "7-de-septiembre", nombre: "7 de Septiembre", precio: 0 },
  { key: "aldea-hostal-del-sol", nombre: "Aldea / Hostal del Sol", precio: 0 },
  { key: "luduena-sur", nombre: "Ludueña Sur", precio: 0 },
  { key: "bella-vista", nombre: "Bella Vista", precio: 0 },
  { key: "san-francisquito", nombre: "San Francisquito", precio: 0 },
  { key: "cinco-esquinas", nombre: "Cinco Esquinas", precio: 0 },
  { key: "triangulo-y-moderno", nombre: "Triángulo y Moderno", precio: 0 },
  { key: "godoy", nombre: "Godoy", precio: 0 },
  { key: "acindar", nombre: "Acindar", precio: 0 },
  { key: "alvear", nombre: "Alvear", precio: 0 },
  { key: "las-delicias", nombre: "Las Delicias", precio: 0 },
  { key: "jorge-cura", nombre: "Jorge Cura", precio: 0 },
  { key: "las-flores", nombre: "Las Flores", precio: 0 },
  { key: "tablada", nombre: "Tablada", precio: 0 },
  { key: "saladillo", nombre: "Saladillo", precio: 0 },
  { key: "tiro-suizo", nombre: "Tiro Suizo", precio: 0 },
  { key: "general-san-martin", nombre: "General San Martín", precio: 0 },
  { key: "general-las-heras", nombre: "General Las Heras", precio: 0 },
  { key: "matheu", nombre: "Matheu", precio: 0 },
  { key: "grandoli", nombre: "Grandoli", precio: 0 },
];

export function getBarrioByKey(key) {
  const k = String(key || "").trim();
  return BARRIOS.find((b) => b.key === k) || null;
}

export function calcEnvioFromBarrioKey(key) {
  const b = getBarrioByKey(key);
  return b ? Number(b.precio || 0) : 0;
}