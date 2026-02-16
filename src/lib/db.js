// PATH: src/lib/db.js
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "./firebase";

export async function getTiendaBySlug(slug) {
  const ref = doc(db, "tiendas", slug);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Tienda no encontrada");
  return { id: snap.id, ...snap.data() };
}

export async function listTiendasPublicas() {
  const ref = collection(db, "tiendas");
  const snap = await getDocs(ref);
  // lectura pública según tus rules
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listProductos(tiendaId) {
  const ref = collection(db, "tiendas", tiendaId, "productos");
  const snap = await getDocs(ref);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
