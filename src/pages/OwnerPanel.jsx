// PATH: src/pages/OwnerPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  where,
  limit,
  deleteDoc, // ✅ NEW
} from "firebase/firestore";
import { app } from "../lib/firebase.js";
import { money } from "../lib/money.js";

function fmtWhen(ts) {
  if (!ts?.seconds) return "";
  const d = new Date(ts.seconds * 1000);
  return d.toLocaleString();
}

function calcTotalPedido(p) {
  const items = Array.isArray(p?.items) ? p.items : [];
  return items.reduce(
    (acc, it) => acc + Number(it?.precioUnitSnapshot || 0) * Number(it?.cantidad || 1),
    0
  );
}

/* ===========================
   ✅ NEW: helpers de día / filtros
   =========================== */
function isTodayFromTs(ts) {
  if (!ts?.seconds) return true; // si falta fecha, NO ocultamos
  const d = new Date(ts.seconds * 1000);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function estadoInfo(estado) {
  const e = String(estado || "").toLowerCase();
  if (e === "pendiente") return { icon: "🟠", label: "Pendiente" };
  if (e === "aceptado") return { icon: "🟢", label: "Aceptado" };
  if (e === "en_preparacion") return { icon: "🟡", label: "En preparación" };
  if (e === "listo") return { icon: "✅", label: "Listo" };
  if (e === "rechazado") return { icon: "⛔", label: "Rechazado" };
  if (e === "entregado") return { icon: "⚫", label: "Entregado" };
  return { icon: "•", label: estado || "—" };
}

function pagoInfo(pedido, total) {
  const pago = String(pedido?.pagoElegido || "").toLowerCase(); // sena | total | efectivo
  const pagado = Number(pedido?.montoAPagarSnapshot || 0);

  if (pago === "sena") {
    const falta = Math.max(0, total - pagado);
    return {
      badge: "SEÑA",
      line1: `Pagó $ ${money(pagado)}`,
      line2: `Falta $ ${money(falta)}`,
    };
  }

  if (pago === "efectivo") {
    return {
      badge: "EFECTIVO",
      line1: "Paga al retirar",
      line2: `Total $ ${money(total)}`,
    };
  }

  // default total
  return {
    badge: "TOTAL",
    line1: `Pagó $ ${money(total)}`,
    line2: "—",
  };
}

function PedidoCard({ pedido, onAction }) {
  const total = calcTotalPedido(pedido);
  const est = estadoInfo(pedido?.estado);
  const pago = pagoInfo(pedido, total);

  const nombre = `${pedido?.cliente?.nombre || ""} ${pedido?.cliente?.apellido || ""}`.trim() || "—";
  const contacto = pedido?.cliente?.contacto || "—";
  const when = fmtWhen(pedido?.createdAt) || "—";

  return (
    <div className="miniCard" style={{ marginBottom: 12, padding: 14 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 950, fontSize: 16, lineHeight: 1.15, wordBreak: "break-word" }}>
            {nombre}
          </div>
          <div style={{ marginTop: 6, opacity: 0.8, fontSize: 12, lineHeight: 1.35 }}>
            <div>📱 {contacto}</div>
            <div>🕒 {when}</div>
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ display: "inline-flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
            <span style={{ fontSize: 12, opacity: 0.9 }}>
              {est.icon} <b>{est.label}</b>
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 950,
                letterSpacing: 0.6,
                padding: "6px 10px",
                borderRadius: 999,
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.10)",
              }}
            >
              {pago.badge}
            </span>
          </div>

          <div style={{ marginTop: 10, fontWeight: 950, fontSize: 18 }}>$ {money(total)}</div>

          <div style={{ marginTop: 4, opacity: 0.82, fontSize: 12, lineHeight: 1.25 }}>
            <div>{pago.line1}</div>
            <div>{pago.line2}</div>
          </div>
        </div>
      </div>

      {/* Mensaje */}
      {pedido?.mensaje ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 14,
            background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <div style={{ opacity: 0.75, fontSize: 12, marginBottom: 6, fontWeight: 900 }}>Mensaje</div>
          <div style={{ fontSize: 13, opacity: 0.95, lineHeight: 1.35, wordBreak: "break-word" }}>
            “{pedido.mensaje}”
          </div>
        </div>
      ) : null}

      {/* Items */}
      <div style={{ marginTop: 12 }}>
        <div style={{ opacity: 0.75, fontSize: 12, marginBottom: 8, fontWeight: 900 }}>Pedido</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(pedido?.items || []).map((it, idx) => {
            const qty = Number(it?.cantidad || 1);
            const unit = Number(it?.precioUnitSnapshot || 0);
            const sub = unit * qty;

            return (
              <div
                key={`${it?.productoId || "x"}-${idx}`}
                style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}
              >
                <div style={{ minWidth: 0, opacity: 0.95 }}>
                  <div style={{ fontWeight: 900, wordBreak: "break-word" }}>
                    {it?.nombreSnapshot}
                    {it?.varianteTituloSnapshot ? (
                      <span style={{ opacity: 0.8, fontWeight: 800 }}> · {it.varianteTituloSnapshot}</span>
                    ) : null}
                  </div>
                  <div style={{ opacity: 0.72, fontSize: 12, marginTop: 2 }}>
                    x{qty} · $ {money(unit)} c/u
                  </div>
                </div>

                <div style={{ fontWeight: 950, flexShrink: 0 }}>$ {money(sub)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer: ETA + actions */}
      <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ opacity: 0.75, fontSize: 12 }}>
          {Number(pedido?.etaMin || 0) > 0 ? (
            <span>
              ⏱ Tiempo estimado <b>{pedido.etaMin}m</b>
            </span>
          ) : (
            <span>⏱ Sin ETA</span>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {pedido?.estado === "pendiente" ? (
            <>
              <button className="btnPrimary" type="button" onClick={() => onAction("aceptar", pedido)}>
                Aceptar
              </button>
              <button className="btnGhost" type="button" onClick={() => onAction("rechazar", pedido)}>
                Rechazar
              </button>
            </>
          ) : null}

          {pedido?.estado === "aceptado" || pedido?.estado === "en_preparacion" ? (
            <>
              <button className="btnPrimary" type="button" onClick={() => onAction("listo", pedido)}>
                Listo para retirar
              </button>
              <button className="btnGhost" type="button" onClick={() => onAction("en5", pedido)}>
                En 5 minutos está listo
              </button>
            </>
          ) : null}

          {pedido?.estado === "listo" ? (
            <button className="btnPrimary" type="button" onClick={() => onAction("entregado", pedido)}>
              Entregado / Cerrado
            </button>
          ) : null}

          {/* ✅ NEW: borrar pedidos pasados (solo rechazado/entregado) */}
          {pedido?.estado === "rechazado" || pedido?.estado === "entregado" ? (
            <button className="btnGhost" type="button" onClick={() => onAction("borrar", pedido)}>
              ❌ Borrar
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
        Estado: <b>{pedido?.estado}</b>
      </div>
    </div>
  );
}

export default function OwnerPanel() {
  const db = getFirestore(app);
  const nav = useNavigate();

  // ⚠️ por ahora fijamos tiendaId.
  // después lo hacemos multi-tiendas con login.
  const [tiendaId] = useState("chaketortas");

  const [pendientes, setPendientes] = useState([]);
  const [encurso, setEncurso] = useState([]);
  const [pasados, setPasados] = useState([]);

  useEffect(() => {
    if (!tiendaId) return;

    const base = collection(db, "tiendas", String(tiendaId), "pedidos");

    // 🔸 Importante: estas queries suelen pedir índices compuestos:
    // (estado ASC, createdAt DESC) para cada grupo. Si Firebase te los pide, los creás desde el link.
    const qPend = query(base, where("estado", "==", "pendiente"), orderBy("createdAt", "desc"), limit(80));

    const qEnCurso = query(
      base,
      where("estado", "in", ["aceptado", "en_preparacion", "listo"]),
      orderBy("createdAt", "desc"),
      limit(80)
    );

    const qPas = query(
      base,
      where("estado", "in", ["rechazado", "entregado"]),
      orderBy("createdAt", "desc"),
      limit(80)
    );

    const unsub1 = onSnapshot(qPend, (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setPendientes(arr);
    });

    const unsub2 = onSnapshot(qEnCurso, (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setEncurso(arr);
    });

    const unsub3 = onSnapshot(qPas, (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setPasados(arr);
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [db, tiendaId]);

  /* ===========================
     ✅ NEW: ocultar pasados si el día ya pasó (solo UI)
     =========================== */
  const pasadosHoy = useMemo(() => pasados.filter((p) => isTodayFromTs(p?.createdAt)), [pasados]);

  /* ===========================
     ✅ NEW: resumen de ganancias (solo entregados de hoy)
     =========================== */
  const entregadosHoy = useMemo(
    () => pasadosHoy.filter((p) => String(p?.estado || "").toLowerCase() === "entregado"),
    [pasadosHoy]
  );

  const resumenHoy = useMemo(() => {
    const totalVendido = entregadosHoy.reduce((acc, p) => acc + calcTotalPedido(p), 0);

    const seniasCobradas = entregadosHoy.reduce((acc, p) => {
      const pago = String(p?.pagoElegido || "").toLowerCase();
      if (pago !== "sena") return acc;
      return acc + Number(p?.montoAPagarSnapshot || 0);
    }, 0);

    const pendienteSenias = entregadosHoy.reduce((acc, p) => {
      const pago = String(p?.pagoElegido || "").toLowerCase();
      if (pago !== "sena") return acc;
      const total = calcTotalPedido(p);
      const pagado = Number(p?.montoAPagarSnapshot || 0);
      return acc + Math.max(0, total - pagado);
    }, 0);

    const efectivoEsperado = entregadosHoy.reduce((acc, p) => {
      const pago = String(p?.pagoElegido || "").toLowerCase();
      if (pago !== "efectivo") return acc;
      return acc + calcTotalPedido(p);
    }, 0);

    return {
      entregados: entregadosHoy.length,
      totalVendido,
      seniasCobradas,
      pendienteSenias,
      efectivoEsperado,
    };
  }, [entregadosHoy]);

  async function onAction(type, pedido) {
    if (!pedido?.id) return;

    const ref = doc(db, "tiendas", String(tiendaId), "pedidos", String(pedido.id));

    if (type === "aceptar") {
      await updateDoc(ref, {
        estado: "aceptado",
        etaMin: 0,
        decisionAt: serverTimestamp(),
      });
      return;
    }

    if (type === "rechazar") {
      await updateDoc(ref, {
        estado: "rechazado",
        closedAt: serverTimestamp(),
        decisionAt: serverTimestamp(),
      });
      return;
    }

    if (type === "en5") {
      await updateDoc(ref, {
        estado: "en_preparacion",
        etaMin: 5,
      });
      return;
    }

    if (type === "listo") {
      await updateDoc(ref, {
        estado: "listo",
        etaMin: 0,
        readyAt: serverTimestamp(),
      });
      return;
    }

    if (type === "entregado") {
      await updateDoc(ref, {
        estado: "entregado",
        closedAt: serverTimestamp(),
      });
      return;
    }

    /* ✅ NEW: borrar (rechazado/entregado) */
    if (type === "borrar") {
      const ok = window.confirm("¿Borrar este pedido? Esta acción no se puede deshacer.");
      if (!ok) return;
      await deleteDoc(ref);
      return;
    }
  }

  return (
    <div style={{ padding: 14, maxWidth: 920, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Panel del local</div>
          <div style={{ opacity: 0.75, fontSize: 13 }}>Tienda: {tiendaId}</div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btnGhost" type="button" onClick={() => nav(`/t/${tiendaId}`)}>
            Ver tienda
          </button>
        </div>
      </div>

      {/* ✅ NEW: Resumen de hoy */}
      <div className="miniCard" style={{ marginTop: 14, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 14 }}>📈 Resumen de hoy</div>
            <div style={{ opacity: 0.75, fontSize: 12 }}>
              Cuenta solo pedidos <b>entregados</b> de hoy.
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 950, fontSize: 18 }}>$ {money(resumenHoy.totalVendido)}</div>
            <div style={{ opacity: 0.75, fontSize: 12 }}>{resumenHoy.entregados} entregados</div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ opacity: 0.9 }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Señas cobradas</div>
            <div style={{ fontWeight: 950 }}>$ {money(resumenHoy.seniasCobradas)}</div>
          </div>

          <div style={{ opacity: 0.9 }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Pendiente (señas)</div>
            <div style={{ fontWeight: 950 }}>$ {money(resumenHoy.pendienteSenias)}</div>
          </div>

          <div style={{ opacity: 0.9 }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Efectivo esperado</div>
            <div style={{ fontWeight: 950 }}>$ {money(resumenHoy.efectivoEsperado)}</div>
          </div>

          <div style={{ opacity: 0.9 }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Total vendido</div>
            <div style={{ fontWeight: 950 }}>$ {money(resumenHoy.totalVendido)}</div>
          </div>
        </div>

        <style>{`
          @media (max-width: 520px){
            .miniCard .__gridResumenHoy { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3 style={{ margin: "14px 0 10px" }}>🟠 Pedidos pendientes ({pendientes.length})</h3>
        {pendientes.length ? (
          pendientes.map((p) => <PedidoCard key={p.id} pedido={p} onAction={onAction} />)
        ) : (
          <div style={{ opacity: 0.7 }}>No hay pendientes.</div>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <h3 style={{ margin: "14px 0 10px" }}>🟢 En preparación / Listos ({encurso.length})</h3>
        {encurso.length ? (
          encurso.map((p) => <PedidoCard key={p.id} pedido={p} onAction={onAction} />)
        ) : (
          <div style={{ opacity: 0.7 }}>No hay pedidos activos.</div>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <h3 style={{ margin: "14px 0 10px" }}>⚫ Pedidos pasados ({pasadosHoy.length})</h3>
        {pasadosHoy.length ? (
          pasadosHoy.map((p) => <PedidoCard key={p.id} pedido={p} onAction={onAction} />)
        ) : (
          <div style={{ opacity: 0.7 }}>No hay pasados (hoy).</div>
        )}

        {/* hint suave por si “desaparecieron” */}
        {pasados.length > pasadosHoy.length ? (
          <div style={{ marginTop: 10, opacity: 0.55, fontSize: 12 }}>
            * Los pedidos pasados de días anteriores se están ocultando automáticamente.
          </div>
        ) : null}
      </div>
    </div>
  );
}
