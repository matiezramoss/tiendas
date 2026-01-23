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
  deleteDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";

import { app, auth } from "../lib/firebase.js";
import { useAdminSession } from "../lib/adminSession.js";
import { money } from "../lib/money.js";
import { openWhatsAppTo } from "../lib/whatsapp.js";

function calcTotalPedido(p) {
  const items = Array.isArray(p?.items) ? p.items : [];
  return items.reduce(
    (acc, it) => acc + Number(it?.precioUnitSnapshot || 0) * Number(it?.cantidad || 1),
    0
  );
}

function isTodayFromTs(ts) {
  if (!ts?.seconds) return true;
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
  const pago = String(pedido?.pagoElegido || "").toLowerCase();
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

  return {
    badge: "TOTAL",
    line1: `Pagó $ ${money(total)}`,
    line2: "—",
  };
}

/* ===========================
   CARD (modo cocina) - simple y clara
   =========================== */
function PedidoCard({ pedido, onAction, tiendaId }) {
  const total = calcTotalPedido(pedido);
  const est = estadoInfo(pedido?.estado);
  const pago = pagoInfo(pedido, total);

  const nombre =
    `${pedido?.cliente?.nombre || ""} ${pedido?.cliente?.apellido || ""}`.trim() || "—";
  const contacto = pedido?.cliente?.contacto || "—";

  return (
    <div className="miniCard" style={{ marginBottom: 12, padding: 14 }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 950, fontSize: 18, lineHeight: 1.1, wordBreak: "break-word" }}>
            {nombre}
          </div>
          <div style={{ marginTop: 6, opacity: 0.9, fontSize: 13 }}>
            📱 <b>{contacto}</b>
            {Number(pedido?.etaMin || 0) > 0 ? (
              <span style={{ marginLeft: 10, opacity: 0.9 }}>⏱ {pedido.etaMin}m</span>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              background: "rgba(255,255,255,.06)",
              border: "1px solid rgba(255,255,255,.10)",
              fontWeight: 950,
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            {est.icon} {est.label}
          </div>

          <button
            className="btnGhost"
            type="button"
            onClick={() =>
              openWhatsAppTo({
                pedido,
                tiendaId,
                tipo: "confirmacion",
                money,
                calcTotalPedido,
                pagoInfo,
              })
            }
          >
            💬 WA
          </button>
        </div>
      </div>

      {/* ITEMS */}
      <div style={{ marginTop: 12 }}>
        <div style={{ opacity: 0.75, fontSize: 12, marginBottom: 8, fontWeight: 900 }}>PEDIDO</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(pedido?.items || []).map((it, idx) => {
            const qty = Number(it?.cantidad || 1);
            const name = String(it?.nombreSnapshot || "Item");
            const varTxt = it?.varianteTituloSnapshot ? ` · ${it.varianteTituloSnapshot}` : "";

            return (
              <div
                key={`${it?.productoId || "x"}-${idx}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.08)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 950, fontSize: 15, wordBreak: "break-word" }}>
                    <span style={{ fontSize: 18, marginRight: 8 }}>x{qty}</span>
                    {name}
                  </div>
                  {varTxt ? (
                    <div style={{ marginTop: 4, opacity: 0.85, fontSize: 13, fontWeight: 800 }}>
                      {varTxt}
                    </div>
                  ) : null}
                </div>

                <div style={{ opacity: 0.7, fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" }}>
                  $ {money(Number(it?.precioUnitSnapshot || 0) * qty)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* NOTA */}
      {pedido?.mensaje ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 14,
            background: "rgba(255,122,0,.10)",
            border: "1px solid rgba(255,122,0,.28)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.9, marginBottom: 6 }}>📝 NOTA</div>
          <div style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.3, wordBreak: "break-word" }}>
            {pedido.mensaje}
          </div>
        </div>
      ) : null}

      {/* PAGO + TOTAL */}
      <div
        style={{
          marginTop: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ opacity: 0.9, fontSize: 13 }}>
          <b>{pago.badge}</b> · {pago.line1}
        </div>

        <div style={{ fontWeight: 950, fontSize: 16 }}>$ {money(total)}</div>
      </div>

      {/* ACCIONES */}
      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {pedido?.estado === "pendiente" ? (
          <>
            <button className="btnPrimary" type="button" onClick={() => onAction("aceptar", pedido)}>
              ✅ Aceptar
            </button>
            <button className="btnGhost" type="button" onClick={() => onAction("rechazar", pedido)}>
              ⛔ Rechazar
            </button>
          </>
        ) : null}

        {pedido?.estado === "aceptado" || pedido?.estado === "en_preparacion" ? (
          <>
            <button className="btnPrimary" type="button" onClick={() => onAction("listo", pedido)}>
              ✅ Listo para retirar
            </button>
            <button className="btnGhost" type="button" onClick={() => onAction("en5", pedido)}>
              ⏱ En 5 minutos
            </button>
          </>
        ) : null}

        {pedido?.estado === "listo" ? (
          <button className="btnPrimary" type="button" onClick={() => onAction("entregado", pedido)}>
            ⚫ Entregado / Cerrar
          </button>
        ) : null}

        {pedido?.estado === "rechazado" || pedido?.estado === "entregado" ? (
          <button className="btnGhost" type="button" onClick={() => onAction("borrar", pedido)}>
            ❌ Borrar
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function OwnerPanel() {
  const db = getFirestore(app);
  const nav = useNavigate();

  const { loading, userDoc, tiendaId } = useAdminSession();

  const [pendientes, setPendientes] = useState([]);
  const [encurso, setEncurso] = useState([]);
  const [pasados, setPasados] = useState([]);

  useEffect(() => {
    if (!tiendaId) return;

    const base = collection(db, "tiendas", String(tiendaId), "pedidos");

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

  const pasadosHoy = useMemo(() => pasados.filter((p) => isTodayFromTs(p?.createdAt)), [pasados]);

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
    if (!pedido?.id || !tiendaId) return;

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

      openWhatsAppTo({
        pedido,
        tiendaId,
        tipo: "en5",
        money,
        calcTotalPedido,
        pagoInfo,
      });
      return;
    }

    if (type === "listo") {
      await updateDoc(ref, {
        estado: "listo",
        etaMin: 0,
        readyAt: serverTimestamp(),
      });

      openWhatsAppTo({
        pedido,
        tiendaId,
        tipo: "listo",
        money,
        calcTotalPedido,
        pagoInfo,
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

    if (type === "borrar") {
      const ok = window.confirm("¿Borrar este pedido? Esta acción no se puede deshacer.");
      if (!ok) return;
      await deleteDoc(ref);
      return;
    }
  }

  async function onLogout() {
    await signOut(auth);
    nav("/admin/login", { replace: true });
  }

  if (loading) return <div className="loading">Cargando…</div>;
  if (!userDoc || !tiendaId) return <div className="loading">No autorizado.</div>;

  return (
    <div style={{ padding: 14, maxWidth: 920, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Panel del local</div>
          <div style={{ opacity: 0.75, fontSize: 13 }}>
            Tienda: {tiendaId} {auth?.currentUser?.email ? `· ${auth.currentUser.email}` : ""}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button className="btnGhost" type="button" onClick={() => nav(`/t/${tiendaId}`)}>
            Ver tienda
          </button>
          <button className="btnGhost" type="button" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </div>

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
      </div>

      <div style={{ marginTop: 16 }}>
        <h3 style={{ margin: "14px 0 10px" }}>🟠 Pedidos pendientes ({pendientes.length})</h3>
        {pendientes.length ? (
          pendientes.map((p) => (
            <PedidoCard key={p.id} pedido={p} onAction={onAction} tiendaId={tiendaId} />
          ))
        ) : (
          <div style={{ opacity: 0.7 }}>No hay pendientes.</div>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <h3 style={{ margin: "14px 0 10px" }}>🟢 En preparación / Listos ({encurso.length})</h3>
        {encurso.length ? (
          encurso.map((p) => (
            <PedidoCard key={p.id} pedido={p} onAction={onAction} tiendaId={tiendaId} />
          ))
        ) : (
          <div style={{ opacity: 0.7 }}>No hay pedidos activos.</div>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <h3 style={{ margin: "14px 0 10px" }}>⚫ Pedidos pasados ({pasadosHoy.length})</h3>
        {pasadosHoy.length ? (
          pasadosHoy.map((p) => (
            <PedidoCard key={p.id} pedido={p} onAction={onAction} tiendaId={tiendaId} />
          ))
        ) : (
          <div style={{ opacity: 0.7 }}>No hay pasados (hoy).</div>
        )}

        {pasados.length > pasadosHoy.length ? (
          <div style={{ marginTop: 10, opacity: 0.55, fontSize: 12 }}>
            * Los pedidos pasados de días anteriores se están ocultando automáticamente.
          </div>
        ) : null}
      </div>
    </div>
  );
}
