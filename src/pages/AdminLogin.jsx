// PATH: src/pages/AdminLogin.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase.js";
import { useAdminSession } from "../lib/adminSession.js";

export default function AdminLogin() {
  const nav = useNavigate();
  const { loading, userDoc, tiendaId, error: sessionError } = useAdminSession();

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  // si ya está validado, mandamos al panel
  useEffect(() => {
    if (!loading && userDoc && tiendaId) {
      nav("/admin", { replace: true });
    }
  }, [loading, userDoc, tiendaId, nav]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    const em = String(email || "").trim();
    const pw = String(pass || "");

    if (!em || !pw) {
      setErr("Completá email y contraseña.");
      return;
    }

    try {
      setSubmitting(true);
      await signInWithEmailAndPassword(auth, em, pw);
      // la validación final la hace useAdminSession leyendo /users/{uid}
    } catch (e2) {
      const code = String(e2?.code || "");
      if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password")) {
        setErr("Email o contraseña incorrectos.");
      } else if (code.includes("auth/user-not-found")) {
        setErr("No existe un usuario con ese email.");
      } else if (code.includes("auth/too-many-requests")) {
        setErr("Demasiados intentos. Probá más tarde.");
      } else {
        setErr("No se pudo iniciar sesión.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const showErr = err || sessionError;

  return (
    <div style={{ padding: 14, maxWidth: 520, margin: "0 auto" }}>
      <div className="miniCard" style={{ padding: 16 }}>
        <div style={{ fontWeight: 950, fontSize: 18 }}>Login Admin</div>
        <div style={{ opacity: 0.75, marginTop: 4, fontSize: 13 }}>
          Acceso solo por mail y contraseña.
        </div>

        <form onSubmit={onSubmit} style={{ marginTop: 14, display: "grid", gap: 10 }}>
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
          />

          <input
            className="input"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Contraseña"
            type="password"
            autoComplete="current-password"
          />

          {showErr ? (
            <div
              style={{
                fontSize: 13,
                opacity: 0.95,
                padding: 10,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,.12)",
                background: "rgba(255,255,255,.05)",
              }}
            >
              ⛔ {showErr}
            </div>
          ) : null}

          <button className="btnPrimary" type="submit" disabled={submitting}>
            {submitting ? "Entrando..." : "Entrar"}
          </button>

        </form>
      </div>
    </div>
  );
}
