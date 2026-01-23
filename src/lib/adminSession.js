// PATH: src/lib/adminSession.js
import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase.js";

export function useAdminSession() {
  const [loading, setLoading] = useState(true);
  const [fbUser, setFbUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});

    const unsub = onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      setError("");
      setFbUser(u || null);
      setUserDoc(null);

      if (!u) {
        setLoading(false);
        return;
      }

      try {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setError("No autorizado: falta /users/{uid}.");
          await signOut(auth);
          setLoading(false);
          return;
        }

        const data = snap.data() || {};
        const tiendaId = String(data.tiendaId || "").trim();

        const isAdmin = data.admin === true;
        const mailDoc = data.mail ? String(data.mail).toLowerCase().trim() : "";
        const mailAuth = u.email ? String(u.email).toLowerCase().trim() : "";
        const mailOk = !mailDoc || mailDoc === mailAuth;

        if (!isAdmin || !tiendaId || !mailOk) {
          setError("No autorizado para panel admin.");
          await signOut(auth);
          setLoading(false);
          return;
        }

        setUserDoc({ id: snap.id, ...data });
        setLoading(false);
      } catch {
        setError("Error validando sesión admin.");
        await signOut(auth);
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const tiendaId = String(userDoc?.tiendaId || "").trim();

  return {
    loading,
    fbUser,
    userDoc,
    tiendaId,
    error,
  };
}
