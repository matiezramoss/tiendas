// PATH: src/lib/delivery.js

// ✅ Editá acá los barrios y precios (sin tocar Firestore)
export const BARRIOS = [
  { key: "centro", nombre: "Centro", precio: 5000 },
  { key: "martin", nombre: "Martin", precio: 5000 },
  { key: "abasto", nombre: "Abasto", precio: 5000 },
  { key: "pichincha", nombre: "Pichincha", precio: 5000 },
  { key: "luis-agote", nombre: "Luis Agote", precio: 5000 },
  { key: "lourdes", nombre: "Lourdes", precio: 5000 },
  { key: "republica-de-la-sexta", nombre: "República de la Sexta", precio: 5000 },
  { key: "espana-y-hospitales", nombre: "España y Hospitales", precio: 3500 },
  { key: "echesortu", nombre: "Echesortu", precio: 5000 },

  { key: "alberdi", nombre: "Alberdi", precio: 7500 },
  { key: "arroyito", nombre: "Arroyito", precio: 7500 },
  { key: "la-florida", nombre: "La Florida", precio: 7500 },
  { key: "refineria", nombre: "Refinería", precio: 7500 },
  { key: "rucci", nombre: "Rucci", precio: 7500 },
  { key: "parque-field", nombre: "Parque Field", precio: 7500 },
  { key: "cristaleria", nombre: "Cristalería", precio: 7500 },
  { key: "la-ceramica", nombre: "La Cerámica", precio: 7500 },

  { key: "fisherton", nombre: "Fisherton", precio: 10000 },

  { key: "belgrano", nombre: "Belgrano", precio: 7500 },
  { key: "azcuenaga", nombre: "Azcuénaga", precio: 5000 },

  { key: "empalme-graneros", nombre: "Empalme Graneros", precio: 10000 },
  { key: "7-de-septiembre", nombre: "7 de Septiembre", precio: 10000 },
  { key: "aldea-hostal-del-sol", nombre: "Aldea / Hostal del Sol", precio: 10000 },

  { key: "luduena-sur", nombre: "Ludueña Sur", precio: 7500 },

  { key: "bella-vista", nombre: "Bella Vista", precio: 3500 },
  { key: "san-francisquito", nombre: "San Francisquito", precio: 3500 },
  { key: "cinco-esquinas", nombre: "Cinco Esquinas", precio: 3500 },
  { key: "triangulo-y-moderno", nombre: "Triángulo y Moderno", precio: 3500 },
  { key: "godoy", nombre: "Godoy", precio: 3500 },
  { key: "acindar", nombre: "Acindar", precio: 3500 },

  { key: "alvear", nombre: "Alvear", precio: 5000 },
  { key: "las-delicias", nombre: "Las Delicias", precio: 5000 },

  { key: "jorge-cura", nombre: "Jorge Cura", precio: 3500 },

  { key: "las-flores", nombre: "Las Flores", precio: 7500 },
  { key: "tablada", nombre: "Tablada", precio: 7500 },
  { key: "saladillo", nombre: "Saladillo", precio: 7500 },

  { key: "tiro-suizo", nombre: "Tiro Suizo", precio: 5000 },
  { key: "general-san-martin", nombre: "General San Martín", precio: 5000 },

  { key: "general-las-heras", nombre: "General Las Heras", precio: 7500 },

  { key: "matheu", nombre: "Matheu", precio: 4000 },
  { key: "grandoli", nombre: "Grandoli", precio: 7500 },
];

export function getBarrioByKey(key) {
  const k = String(key || "").trim();
  return BARRIOS.find((b) => b.key === k) || null;
}

export function calcEnvioFromBarrioKey(key) {
  const b = getBarrioByKey(key);
  return b ? Number(b.precio || 0) : 0;
}
