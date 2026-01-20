// PATH: src/pages/TrackingPedido.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import { app } from "../lib/firebase.js";
import { money } from "../lib/money.js";

function fmtWhen(ts) {
  if (!ts?.seconds) return "";
  const d = new Date(ts.seconds * 1000);
  return d.toLocaleString();
}

function calcTotalPedido(p) {
  const items = Array.isArray(p?.items) ? p.items : [];
  return items.reduce((acc, it) => acc + Number(it?.precioUnitSnapshot || 0) * Number(it?.cantidad || 1), 0);
}

function labelEstado(estado) {
  const e = String(estado || "").toLowerCase();
  if (e === "pendiente") return "🟠 Pendiente (esperando confirmación del local)";
  if (e === "aceptado") return "🟢 Aceptado (en preparación)";
  if (e === "en_preparacion") return "🟡 En preparación";
  if (e === "listo") return "✅ Listo para retirar";
  if (e === "rechazado") return "🔴 Rechazado";
  if (e === "entregado") return "⚫ Entregado / Cerrado";
  return `Estado: ${estado || "—"}`;
}

export default function TrackingPedido() {
  const db = getFirestore(app);
  const nav = useNavigate();
  const { slug, id } = useParams();

  const tiendaId = String(slug || "").trim();
  const pedidoId = String(id || "").trim();

  const [pedido, setPedido] = useState(null);
  const [exists, setExists] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tiendaId || !pedidoId) return;

    const ref = doc(db, "tiendas", tiendaId, "pedidos", pedidoId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setLoading(false);
        setExists(snap.exists());
        setPedido(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      },
      (err) => {
        console.error("TrackingPedido onSnapshot error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [db, tiendaId, pedidoId]);

  const total = useMemo(() => calcTotalPedido(pedido), [pedido]);

  const pago = String(pedido?.pagoElegido || "—");
  const montoAhora = Number(pedido?.montoAPagarSnapshot || 0);
  const etaMin = Number(pedido?.etaMin || 0);

  if (!tiendaId || !pedidoId) {
    return <div className="loading">Falta tienda o id de pedido.</div>;
  }

  if (loading) {
    return <div className="loading">Cargando pedido…</div>;
  }

  if (!exists) {
    return (
      <div style={{ padding: 14, maxWidth: 920, margin: "0 auto" }}>
        <div className="miniCard">
          <h4>Pedido no encontrado</h4>
          <div style={{ opacity: 0.8, marginTop: 6 }}>
            No existe <b>{pedidoId}</b> en <b>{tiendaId}</b>.
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btnPrimary" type="button" onClick={() => nav(`/t/${tiendaId}`)}>
              Volver a la tienda
            </button>
            <button className="btnGhost" type="button" onClick={() => nav("/owner")}>
              Ir al panel del local
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 14, maxWidth: 920, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Tracking pedido</div>
          <div style={{ opacity: 0.75, fontSize: 13 }}>
            Tienda: <b>{tiendaId}</b> · Pedido: <b>{pedidoId}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btnGhost" type="button" onClick={() => nav(`/t/${tiendaId}`)}>
            Ver tienda
          </button>
        </div>
      </div>

      <div className="miniCard" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 14 }}>{labelEstado(pedido?.estado)}</div>

        <div style={{ marginTop: 8, opacity: 0.85, fontSize: 13 }}>
          Creado: <b>{fmtWhen(pedido?.createdAt) || "—"}</b>
          {pedido?.decisionAt ? (
            <>
              {" "}
              · Decisión: <b>{fmtWhen(pedido?.decisionAt)}</b>
            </>
          ) : null}
        </div>

        {etaMin > 0 ? (
          <div style={{ marginTop: 8, fontWeight: 900 }}>⏱️ Retirar en {etaMin} minutos</div>
        ) : null}

        {pedido?.mensaje ? (
          <div style={{ marginTop: 10, opacity: 0.9, fontSize: 13 }}>
            <b>Mensaje:</b> “{pedido.mensaje}”
          </div>
        ) : null}
      </div>

      <div className="miniCard" style={{ marginTop: 12 }}>
        <h4>Resumen</h4>

        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {(pedido?.items || []).map((it, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                fontSize: 13,
                alignItems: "flex-start",
              }}
            >
              <div style={{ opacity: 0.95 }}>
                <b>{it?.nombreSnapshot}</b>
                {it?.varianteTituloSnapshot ? ` · ${it.varianteTituloSnapshot}` : ""}
                <span style={{ opacity: 0.8 }}> · x{it?.cantidad || 1}</span>
              </div>
              <div style={{ fontWeight: 900 }}>
                $ {money(Number(it?.precioUnitSnapshot || 0) * Number(it?.cantidad || 1))}
              </div>
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            <b>Total</b>
            <b>$ {money(total)}</b>
          </div>

          <div style={{ marginTop: 8, opacity: 0.9, fontSize: 13 }}>
            Pago: <b>{pago}</b>
            {pago === "sena" || pago === "total" ? (
              <>
                {" "}
                · Pagás ahora: <b>$ {money(montoAhora)}</b>
              </>
            ) : null}
            {pago === "efectivo" ? <> · Pagás al retirar</> : null}
          </div>
        </div>
      </div>
    </div>
  );
}