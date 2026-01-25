// PATH: src/pages/OwnerPanel.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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

// ✅ usamos tu delivery.js si querés “resolver nombre/precio” desde key
import { getBarrioByKey } from "../lib/delivery.js";

/* ===========================
   HELPERS
   =========================== */
function calcSubTotalPedido(p) {
  const items = Array.isArray(p?.items) ? p.items : [];
  return items.reduce(
    (acc, it) => acc + Number(it?.precioUnitSnapshot || 0) * Number(it?.cantidad || 1),
    0
  );
}

// ✅ total “real”: si existe totalFinalSnapshot (subTotal + envío) lo usamos
function calcTotalPedido(p) {
  const tf = Number(p?.totalFinalSnapshot ?? p?.totalSnapshot ?? NaN);
  if (Number.isFinite(tf)) return tf;

  const sub = calcSubTotalPedido(p);
  const envio = Number(p?.envioPrecioSnapshot || 0);
  return sub + envio;
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

function pagoInfo(pedido, totalFinal) {
  const pago = String(pedido?.pagoElegido || "").toLowerCase();
  const pagado = Number(pedido?.montoAPagarSnapshot || 0);

  if (pago === "sena") {
    const falta = Math.max(0, totalFinal - pagado);
    return {
      badge: "SEÑA",
      line1: `Pagó $ ${money(pagado)}`,
      line2: `Falta $ ${money(falta)}`,
    };
  }

  if (pago === "efectivo") {
    return {
      badge: "EFECTIVO",
      line1: "Paga al recibir/retirar",
      line2: `Total $ ${money(totalFinal)}`,
    };
  }

  return {
    badge: "TOTAL",
    line1: `Pagó $ ${money(totalFinal)}`,
    line2: "—",
  };
}

function tsToMs(ts) {
  if (!ts?.seconds) return 0;
  return Number(ts.seconds) * 1000 + Math.floor(Number(ts.nanoseconds || 0) / 1e6);
}

/* ===========================
   ✅ NUEVO: EXTRAS/OPCIONES helpers
   (solo para MOSTRAR, no toca totales ni nada)
   =========================== */
function getExtrasDeItem(it) {
  // En tu carrito se guarda como `opcionesSnapshot: [...]`
  const arr = Array.isArray(it?.opcionesSnapshot) ? it.opcionesSnapshot : [];
  // Filtramos lo mínimo para evitar basura
  return arr
    .map((x) => ({
      grupoTitulo: String(x?.grupoTitulo || "").trim(),
      itemTitulo: String(x?.itemTitulo || "").trim(),
      precioExtra: Number(x?.precioExtra || 0),
    }))
    .filter((x) => x.itemTitulo);
}

/* ===========================
   DELIVERY / RETIRO helpers
   =========================== */
function entregaInfo(pedido) {
  const tipo = String(pedido?.entregaTipo || pedido?.entrega || "retiro").toLowerCase(); // tolerante

  const envioPrecio = Number(pedido?.envioPrecioSnapshot || 0);
  const direccion = String(pedido?.direccionSnapshot || pedido?.direccion || "").trim();

  // barrio por snapshot o por key
  const barrioKey = String(pedido?.barrioKeySnapshot || pedido?.barrioKey || "").trim();
  const barrioNombreSnapshot = String(pedido?.barrioNombreSnapshot || pedido?.barrioNombre || "").trim();
  const barrioObj = barrioKey ? getBarrioByKey(barrioKey) : null;
  const barrioNombre = barrioNombreSnapshot || barrioObj?.nombre || (barrioKey ? barrioKey : "");

  const isDelivery = tipo === "delivery";

  return {
    tipo: isDelivery ? "delivery" : "retiro",
    label: isDelivery ? "DELIVERY" : "RETIRO",
    icon: isDelivery ? "🛵" : "🏪",
    envioPrecio,
    direccion,
    barrioKey,
    barrioNombre,
  };
}

/* ===========================
   NOTIF + SONIDO (solo panel)
   =========================== */
function playBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;

    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ctx.destination);

    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    o.start(now);
    o.stop(now + 0.16);

    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        // noop
      }
    }, 250);
  } catch {
    // noop
  }
}

function notifyNewOrder({ title, body }) {
  try {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
      new Notification(title, { body });
      return;
    }

    if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") new Notification(title, { body });
      });
    }
  } catch {
    // noop
  }
}

/* ===========================
   CARD (modo cocina) - simple y clara
   =========================== */
function PedidoCard({ pedido, onAction, tiendaId }) {
  const totalFinal = calcTotalPedido(pedido);
  const subTotal = calcSubTotalPedido(pedido);
  const est = estadoInfo(pedido?.estado);
  const pago = pagoInfo(pedido, totalFinal);

  const nombre =
    `${pedido?.cliente?.nombre || ""} ${pedido?.cliente?.apellido || ""}`.trim() || "—";
  const contacto = String(pedido?.cliente?.contacto || "—");

  const eta = Number(pedido?.etaMin || 0);
  const nota = String(pedido?.mensaje || "").trim();

  const entrega = entregaInfo(pedido);

  return (
    <div className="miniCard cocinaCard">
      {/* HEADER */}
      <div className="cocinaHeader">
        <div className="cocinaWho">
          <div className="cocinaName">{nombre}</div>

          <div className="cocinaMeta">
            <span>
              📱 <b>{contacto}</b>
            </span>
            {eta > 0 ? <span className="cocinaEta">⏱ {eta}m</span> : null}
          </div>
        </div>

        <div className="cocinaRight">
          <div className="cocinaEstado">
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
            title="Abrir WhatsApp"
          >
            💬 WA
          </button>
        </div>
      </div>

      {/* ✅ ENTREGA (MUY LLAMATIVO) */}
      <div className={`cocinaEntrega ${entrega.tipo === "delivery" ? "isDelivery" : "isRetiro"}`}>
        <div className="cocinaEntregaMain">
          <span className="cocinaEntregaIcon">{entrega.icon}</span>
          <span className="cocinaEntregaLabel">{entrega.label}</span>
          {entrega.tipo === "delivery" && Number.isFinite(entrega.envioPrecio) && entrega.envioPrecio > 0 ? (
            <span className="cocinaEntregaPrice">ENVÍO $ {money(entrega.envioPrecio)}</span>
          ) : null}
        </div>

        {entrega.tipo === "delivery" ? (
          <div className="cocinaEntregaDetails">
            {entrega.barrioNombre ? (
              <div>
                <b>Barrio:</b> {entrega.barrioNombre}
              </div>
            ) : null}
            {entrega.direccion ? (
              <div>
                <b>Dirección:</b> {entrega.direccion}
              </div>
            ) : (
              <div style={{ opacity: 0.9 }}>
                <b>Dirección:</b> —
              </div>
            )}
          </div>
        ) : (
          <div className="cocinaEntregaDetails" style={{ opacity: 0.9 }}>
            Retira en el local.
          </div>
        )}
      </div>

      {/* ITEMS */}
      <div className="cocinaBlockTitle">PEDIDO</div>
      <div className="cocinaItems">
        {(pedido?.items || []).map((it, idx) => {
          const qty = Number(it?.cantidad || 1);
          const name = String(it?.nombreSnapshot || "Item");
          const varTxt = it?.varianteTituloSnapshot ? ` · ${it.varianteTituloSnapshot}` : "";
          const sub = Number(it?.precioUnitSnapshot || 0) * qty;

          // ✅ NUEVO: extras elegidos por item
          const extrasArr = getExtrasDeItem(it);

          return (
            <div className="cocinaItem" key={`${it?.productoId || "x"}-${idx}`}>
              <div className="cocinaItemLeft">
                <div className="cocinaItemName">
                  <span className="cocinaQty">({qty})</span>
                  <span>{name}</span>
                </div>

                {varTxt ? <div className="cocinaVar">{varTxt}</div> : null}

                {/* ✅ NUEVO: MOSTRAR EXTRAS/OPCIONES */}
                {extrasArr.length ? (
                  <div className="cocinaExtras">
                    <div className="cocinaExtrasTitle">Extras / Opciones:</div>
                    <div className="cocinaExtrasList">
                      {extrasArr.map((x, i) => (
                        <div className="cocinaExtraLine" key={`${idx}-ex-${i}`}>
                          <span className="cocinaExtraDot">＋</span>
                          <span className="cocinaExtraText">
                            {x.itemTitulo}
                            {x.grupoTitulo ? <span className="cocinaExtraGroup"> ({x.grupoTitulo})</span> : null}
                          </span>
                          {Number(x.precioExtra || 0) ? (
                            <span className="cocinaExtraPrice">+$ {money(x.precioExtra)}</span>
                          ) : (
                            <span className="cocinaExtraPrice"> </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="cocinaItemPrice">$ {money(sub)}</div>
            </div>
          );
        })}
      </div>

      {/* NOTA (muy visible) */}
      {nota ? (
        <div className="cocinaNota" title="Nota del cliente">
          <div className="cocinaNotaTitle">📝 NOTA</div>
          <div className="cocinaNotaText">{nota}</div>
        </div>
      ) : null}

      {/* ✅ RESUMEN DE TOTALES (si hay envío, se muestra) */}
      <div className="cocinaTotales">
        <div className="cocinaTotRow">
          <span>Subtotal</span>
          <b>$ {money(subTotal)}</b>
        </div>

        {entrega.tipo === "delivery" ? (
          <div className="cocinaTotRow">
            <span>Envío</span>
            <b>$ {money(Number(entrega.envioPrecio || 0))}</b>
          </div>
        ) : null}

        <div className="cocinaTotRow total">
          <span>Total</span>
          <b>$ {money(totalFinal)}</b>
        </div>
      </div>

      {/* PAGO */}
      <div className="cocinaFooter">
        <div className="cocinaPago">
          <b>{pago.badge}</b> · {pago.line1}
          {pago?.line2 && pago.line2 !== "—" ? <span className="cocinaPago2"> · {pago.line2}</span> : null}
        </div>
        <div className="cocinaTotal">$ {money(totalFinal)}</div>
      </div>

      {/* ACCIONES */}
      <div className="cocinaActions">
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

/* ===========================
   PAGE
   =========================== */
export default function OwnerPanel() {
  const db = getFirestore(app);
  const nav = useNavigate();
  const { loading, userDoc, tiendaId } = useAdminSession();

  const [pendientes, setPendientes] = useState([]);
  const [encurso, setEncurso] = useState([]);
  const [pasados, setPasados] = useState([]);

  // Para detectar “nuevos pedidos” y no spamear en el primer render
  const seenIdsRef = useRef(new Set());
  const hydratedRef = useRef(false);

  useEffect(() => {
    try {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    } catch {
      // noop
    }
  }, []);

  function handleIncomingPendientes(arr) {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      seenIdsRef.current = new Set(arr.map((x) => x.id));
      return;
    }

    const prev = seenIdsRef.current;
    const nuevos = arr.filter((x) => x?.id && !prev.has(x.id));

    if (nuevos.length) {
      nuevos.forEach((x) => prev.add(x.id));

      const first = nuevos[0];
      const nombre =
        `${first?.cliente?.nombre || ""} ${first?.cliente?.apellido || ""}`.trim() || "Nuevo pedido";
      const total = calcTotalPedido(first);

      notifyNewOrder({
        title: "🟠 Nuevo pedido",
        body: `${nombre} · $ ${money(total)}`,
      });

      playBeep();
    }
  }

  useEffect(() => {
    if (!tiendaId) return;

    const base = collection(db, "tiendas", String(tiendaId), "pedidos");

    const qPend = query(base, where("estado", "==", "pendiente"), orderBy("createdAt", "asc"), limit(120));
    const qEnCurso = query(
      base,
      where("estado", "in", ["aceptado", "en_preparacion", "listo"]),
      orderBy("createdAt", "desc"),
      limit(120)
    );
    const qPas = query(base, where("estado", "in", ["rechazado", "entregado"]), orderBy("createdAt", "desc"), limit(120));

    const unsub1 = onSnapshot(qPend, (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      arr.sort((a, b) => tsToMs(a?.createdAt) - tsToMs(b?.createdAt));
      setPendientes(arr);
      handleIncomingPendientes(arr);
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
      await updateDoc(ref, { estado: "aceptado", etaMin: 0, decisionAt: serverTimestamp() });
      return;
    }

    if (type === "rechazar") {
      await updateDoc(ref, { estado: "rechazado", closedAt: serverTimestamp(), decisionAt: serverTimestamp() });
      return;
    }

    if (type === "en5") {
      await updateDoc(ref, { estado: "en_preparacion", etaMin: 5 });
      openWhatsAppTo({ pedido, tiendaId, tipo: "en5", money, calcTotalPedido, pagoInfo });
      return;
    }

    if (type === "listo") {
      await updateDoc(ref, { estado: "listo", etaMin: 0, readyAt: serverTimestamp() });
      openWhatsAppTo({ pedido, tiendaId, tipo: "listo", money, calcTotalPedido, pagoInfo });
      return;
    }

    if (type === "entregado") {
      await updateDoc(ref, { estado: "entregado", closedAt: serverTimestamp() });
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
  <div className="ownerWrap">
      {/* styles locales (grilla + nota + entrega + extras) */}
      <style>{`
              /* ✅ Scroll real dentro del panel (mobile + desktop) */
        .ownerWrap{
          height: 100dvh;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          padding: 14px;
          max-width: 1100px;
          margin: 0 auto;
          box-sizing: border-box;
        }

        .cocinaGrid{
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap: 3.5rem;
        }
        @media (max-width: 860px){
          .cocinaGrid{ grid-template-columns: 1fr; }
        }

        .cocinaCard{
          padding: 14px;
          margin-bottom: 0 !important;
        }

        .cocinaHeader{
          display:flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 12px;
        }
        .cocinaWho{ min-width: 0; }
        .cocinaName{
          font-weight: 950;
          font-size: 18px;
          line-height: 1.1;
          word-break: break-word;
        }
        .cocinaMeta{
          margin-top: 6px;
          opacity: .9;
          font-size: 13px;
          display:flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items:center;
        }
        .cocinaEta{
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.06);
          font-weight: 900;
        }

        .cocinaRight{
          display:flex;
          gap: 10px;
          align-items:center;
          flex-shrink: 0;
        }
        .cocinaEstado{
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.10);
          font-weight: 950;
          font-size: 13px;
          white-space: nowrap;
        }

        /* ✅ ENTREGA MUY LLAMATIVA */
        .cocinaEntrega{
          margin-top: 10px;
          padding: 12px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.04);
        }
        .cocinaEntrega.isDelivery{
          border: 1px solid rgba(0,255,180,.22);
          background: rgba(0,255,180,.08);
          animation: entregaPulse 1.6s ease-in-out infinite;
        }
        .cocinaEntrega.isRetiro{
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.03);
        }
        @keyframes entregaPulse{
          0%,100%{ transform: scale(1); box-shadow: 0 0 0 rgba(0,255,180,0); }
          50%{ transform: scale(1.01); box-shadow: 0 0 0 6px rgba(0,255,180,.06); }
        }
        .cocinaEntregaMain{
          display:flex;
          align-items:center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .cocinaEntregaIcon{
          font-size: 18px;
        }
        .cocinaEntregaLabel{
          font-weight: 1000;
          letter-spacing: .06em;
          font-size: 14px;
        }
        .cocinaEntregaPrice{
          margin-left: auto;
          font-weight: 1000;
          font-size: 14px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(0,0,0,.18);
          border: 1px solid rgba(0,0,0,.20);
        }
        .cocinaEntregaDetails{
          margin-top: 8px;
          font-size: 13px;
          opacity: .95;
          display:flex;
          flex-direction: column;
          gap: 4px;
          word-break: break-word;
        }

        .cocinaBlockTitle{
          margin-top: 14px;
          opacity: .75;
          font-size: 12px;
          margin-bottom: 8px;
          font-weight: 900;
          letter-spacing: .03em;
        }

        .cocinaItems{
          display:flex;
          flex-direction: column;
          gap: 8px;
        }
        .cocinaItem{
          display:flex;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.08);
          align-items: flex-start;
        }
        .cocinaItemLeft{ min-width: 0; flex: 1; }
        .cocinaQty{
          display:inline-block;
          min-width: 2.3rem;
          font-weight: 700;
        }
        .cocinaItemName{
          font-weight: 950;
          font-size: 2rem;
          word-break: break-word;
        }
        .cocinaVar{
          margin-top: 4px;
          opacity: .85;
          font-size: 1.5rem;
          font-weight: 800;
          word-break: break-word;
        }
        .cocinaItemPrice{
          opacity: .75;
          font-size: 2rem;
          font-weight: 950;
          white-space: nowrap;
          padding-top: 4px;
        }

        /* ✅ NUEVO: Extras visibles (clave) */
        .cocinaExtras{
          margin-top: 10px;
          padding: 10px 10px;
          border-radius: 12px;
          background: rgba(255,255,255,.03);
          border: 1px dashed rgba(255,255,255,.14);
        }
        .cocinaExtrasTitle{
          font-size: 12px;
          font-weight: 950;
          opacity: .85;
          margin-bottom: 6px;
          letter-spacing: .02em;
        }
        .cocinaExtrasList{
          display:flex;
          flex-direction: column;
          gap: 6px;
        }
        .cocinaExtraLine{
          display:flex;
          gap: 8px;
          align-items: baseline;
          justify-content: space-between;
        }
        .cocinaExtraDot{
          font-weight: 1000;
          opacity: .85;
        }
        .cocinaExtraText{
          flex: 1;
          min-width: 0;
          font-size: 13px;
          font-weight: 900;
          opacity: .95;
          word-break: break-word;
        }
        .cocinaExtraGroup{
          opacity: .7;
          font-weight: 800;
        }
        .cocinaExtraPrice{
          font-size: 13px;
          font-weight: 1000;
          opacity: .9;
          white-space: nowrap;
          margin-left: 10px;
        }

        .cocinaNota{
          margin-top: 12px;
          padding: 12px;
          border-radius: 14px;
          background: rgba(255,122,0,.14);
          border: 1px solid rgba(255,122,0,.35);
          animation: notaPulse 1.6s ease-in-out infinite;
        }
        .cocinaNotaTitle{
          font-size: 12px;
          font-weight: 950;
          opacity: .95;
          margin-bottom: 6px;
          letter-spacing: .03em;
        }
        .cocinaNotaText{
          font-size: 14px;
          font-weight: 950;
          line-height: 1.3;
          word-break: break-word;
        }
        @keyframes notaPulse{
          0%,100%{ transform: scale(1); box-shadow: 0 0 0 rgba(255,122,0,0); }
          50%{ transform: scale(1.01); box-shadow: 0 0 0 6px rgba(255,122,0,.06); }
        }

        /* ✅ Totales */
        .cocinaTotales{
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.08);
          background: rgba(255,255,255,.03);
          display:flex;
          flex-direction: column;
          gap: 6px;
        }
        .cocinaTotRow{
          display:flex;
          justify-content: space-between;
          gap: 10px;
          font-size: 13px;
          opacity: .95;
        }
        .cocinaTotRow.total{
          padding-top: 6px;
          margin-top: 4px;
          border-top: 1px dashed rgba(255,255,255,.10);
          font-size: 14px;
          font-weight: 950;
          opacity: 1;
        }

        .cocinaFooter{
          margin-top: 14px;
          display:flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 10px;
          flex-wrap: wrap;
        }
        .cocinaPago{
          opacity: .9;
          font-size: 1rem;
        }
        .cocinaPago2{ opacity: .9; }
        .cocinaTotal{
          font-weight: 950;
          font-size: 16px;
        }
        .cocinaActions{
          margin-top: 12px;
          display:flex;
          gap: 10px;
          flex-wrap: wrap;
        }
                  /* ✅ Mobile: nombre -> extras -> precio (precio abajo) */
        @media (max-width: 520px){
          .cocinaItem{
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }

          /* el bloque izquierdo ocupa todo el ancho */
          .cocinaItemLeft{
            width: 100%;
          }

          /* precio baja abajo y queda alineado prolijo */
          .cocinaItemPrice{
            width: 100%;
            padding-top: 0;
            text-align: right;
            opacity: .95;
            font-weight: 950;
          }
        }

      `}</style>

      {/* top */}
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

      {/* resumen */}
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

      {/* pendientes */}
      <div style={{ marginTop: 16 }}>
        <h3 style={{ margin: "1rem 0 10px" }}>🟠 Pedidos pendientes ({pendientes.length})</h3>

        {pendientes.length ? (
          <div className="cocinaGrid">
            {pendientes.map((p) => (
              <PedidoCard key={p.id} pedido={p} onAction={onAction} tiendaId={tiendaId} />
            ))}
          </div>
        ) : (
          <div style={{ opacity: 0.7 }}>No hay pendientes.</div>
        )}
      </div>

      {/* en curso */}
      <div style={{ marginTop: 18 }}>
        <h3 style={{ margin: "5rem 0 10px" }}>🟢 En preparación / Listos ({encurso.length})</h3>

        {encurso.length ? (
          <div className="cocinaGrid">
            {encurso.map((p) => (
              <PedidoCard key={p.id} pedido={p} onAction={onAction} tiendaId={tiendaId} />
            ))}
          </div>
        ) : (
          <div style={{ opacity: 0.7 }}>No hay pedidos activos.</div>
        )}
      </div>

      {/* pasados */}
      <div style={{ marginTop: 18 }}>
        <h3 style={{ margin: "5rem 0 10px" }}>⚫ Pedidos pasados ({pasadosHoy.length})</h3>

        {pasadosHoy.length ? (
          <div className="cocinaGrid">
            {pasadosHoy.map((p) => (
              <PedidoCard key={p.id} pedido={p} onAction={onAction} tiendaId={tiendaId} />
            ))}
          </div>
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
