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

/** ✅ Estados con color + etiqueta corta (para “boleta”) */
function estadoBadge(estado) {
  const e = String(estado || "").toLowerCase();
  if (e === "pendiente") return { icon: "🟠", title: "PENDIENTE", desc: "Esperando confirmación del local" };
  if (e === "aceptado") return { icon: "🟢", title: "ACEPTADO", desc: "En preparación" };
  if (e === "en_preparacion") return { icon: "🟡", title: "EN PREPARACIÓN", desc: "Tu pedido está en cocina" };
  if (e === "listo") return { icon: "✅", title: "LISTO", desc: "Listo para retirar / entregar" };
  if (e === "rechazado") return { icon: "🔴", title: "RECHAZADO", desc: "El local no pudo tomar el pedido" };
  if (e === "entregado") return { icon: "⚫", title: "ENTREGADO", desc: "Pedido cerrado" };
  return { icon: "•", title: String(estado || "—").toUpperCase(), desc: "" };
}

function entregaInfo(pedido) {
  // ✅ soporta ambos: entregaSnapshot y campos planos que agregaste
  const tipo =
    String(pedido?.entregaSnapshot?.tipo || pedido?.entregaTipo || "retiro").toLowerCase() === "delivery"
      ? "delivery"
      : "retiro";

  const direccion =
    String(pedido?.entregaSnapshot?.direccion || pedido?.direccionSnapshot || "").trim();

  const barrioNombre =
    String(pedido?.entregaSnapshot?.barrioNombre || pedido?.barrioNombreSnapshot || "").trim();

  const envio =
    Number(
      pedido?.entregaSnapshot?.envio ??
        pedido?.envioPrecioSnapshot ??
        pedido?.envioSnapshot ??
        0
    ) || 0;

  return { tipo, direccion, barrioNombre, envio };
}



function pagoInfo(pedido, totalFinal) {
  const pago = String(pedido?.pagoElegido || "").toLowerCase();
  const montoAhora = Number(pedido?.montoAPagarSnapshot || 0);

  if (pago === "efectivo") {
    return {
      badge: "EFECTIVO",
      line1: "Pagás al recibir / retirar",
      line2: `Total $ ${money(totalFinal)}`,
    };
  }

  if (pago === "sena") {
    const falta = Math.max(0, totalFinal - montoAhora);
    return {
      badge: "SEÑA",
      line1: `Pagaste $ ${money(montoAhora)} (seña)`,
      line2: `Falta $ ${money(falta)}`,
    };
  }

  return {
    badge: "TOTAL",
    line1: `Pagás ahora $ ${money(montoAhora || totalFinal)}`,
    line2: "Transferencia",
  };
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

  const totalItems = useMemo(() => calcTotalPedido(pedido), [pedido]);

  // ✅ total final (con envío) si existe, si no cae al total de items
  const totalFinal = useMemo(() => {
    const v =
      Number(pedido?.totalFinalSnapshot ?? pedido?.totalFinal ?? 0) ||
      Number(pedido?.totalSnapshot ?? 0) ||
      0;
    return v > 0 ? v : totalItems;
  }, [pedido, totalItems]);

  const subtotal = useMemo(() => {
    const v = Number(pedido?.subtotalSnapshot ?? 0);
    return v > 0 ? v : totalItems;
  }, [pedido, totalItems]);

  const { tipo: entregaTipo, direccion, barrioNombre, envio } = useMemo(
    () => entregaInfo(pedido),
    [pedido]
  );

  const etaMin = Number(pedido?.etaMin || 0);
  const est = estadoBadge(pedido?.estado);
  const pago = pagoInfo(pedido, totalFinal);

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
          </div>
        </div>
      </div>
    );
  }

  const clienteNombre =
    `${pedido?.cliente?.nombre || ""} ${pedido?.cliente?.apellido || ""}`.trim() || "—";
  const clienteContacto = String(pedido?.cliente?.contacto || "—");

  return (
  <div className="trackingWrap">
      {/* ✅ estilos “boleta” + status */}
      <style>{`
        .boletaWrap{
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.03);
          box-shadow: 0 18px 60px rgba(0,0,0,.35);
        }

        .boletaTop{
          padding: 14px 14px 12px;
          display:flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
          border-bottom: 1px dashed rgba(255,255,255,.16);
        }

        .boletaBrand{
          display:flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
        .boletaTitle{
          font-weight: 950;
          font-size: 16px;
          line-height: 1.1;
          letter-spacing: .02em;
        }
        .boletaMeta{
          opacity: .8;
          font-size: 12px;
          display:flex;
          flex-wrap: wrap;
          gap: 8px 10px;
        }
        .boletaMeta b{ opacity: .95; }

        .estadoChip{
          flex-shrink: 0;
          display:flex;
          align-items:center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 999px;
          font-weight: 950;
          font-size: 12px;
          letter-spacing: .03em;
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(0,0,0,.18);
        }
        .estadoChip .sub{
          opacity: .85;
          font-weight: 900;
          letter-spacing: 0;
          text-transform: none;
          font-size: 11px;
          margin-top: 2px;
        }
        .estadoChipCol{
          display:flex;
          flex-direction: column;
          align-items:flex-start;
          line-height: 1.1;
        }

        /* color por estado (muy sutil, no rompe tema) */
        .st-pendiente{ border-color: rgba(255,165,0,.35); background: rgba(255,165,0,.10); }
        .st-aceptado{ border-color: rgba(0,200,120,.35); background: rgba(0,200,120,.10); }
        .st-en_preparacion{ border-color: rgba(255,210,0,.35); background: rgba(255,210,0,.10); }
        .st-listo{ border-color: rgba(160,255,160,.35); background: rgba(160,255,160,.10); }
        .st-rechazado{ border-color: rgba(255,90,90,.35); background: rgba(255,90,90,.10); }
        .st-entregado{ border-color: rgba(255,255,255,.18); background: rgba(255,255,255,.06); }

        .boletaBody{
          padding: 14px;
        }

        .boletaSection{
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px dashed rgba(255,255,255,.14);
        }
        .boletaH{
          font-size: 12px;
          letter-spacing: .08em;
          font-weight: 950;
          opacity: .75;
        }

        .infoGrid{
          margin-top: 10px;
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        @media (max-width: 560px){
          .infoGrid{ grid-template-columns: 1fr; }
        }
        .infoBox{
          padding: 12px;
          border-radius: 14px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.08);
        }
        .infoLabel{
          font-size: 11px;
          opacity: .7;
          font-weight: 900;
        }
        .infoValue{
          margin-top: 6px;
          font-weight: 950;
          font-size: 13px;
          word-break: break-word;
        }
        .infoSmall{
          margin-top: 6px;
          opacity: .8;
          font-size: 12px;
          font-weight: 800;
        }

        .items{
          margin-top: 10px;
          display:flex;
          flex-direction: column;
          gap: 8px;
        }
        .itRow{
          display:flex;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.08);
          align-items: flex-start;
        }
        .itLeft{ min-width: 0; }
        .itName{
          font-weight: 950;
          font-size: 13px;
          line-height: 1.2;
          word-break: break-word;
        }
        .itMeta{
          margin-top: 6px;
          opacity: .75;
          font-size: 12px;
          font-weight: 800;
        }
        .itPrice{
          font-weight: 950;
          white-space: nowrap;
          font-size: 13px;
          opacity: .95;
        }

        .totals{
          margin-top: 10px;
          display:flex;
          flex-direction: column;
          gap: 8px;
        }
        .totLine{
          display:flex;
          justify-content: space-between;
          gap: 10px;
          font-weight: 900;
        }
        .totLine .muted{ opacity: .8; font-weight: 900; }
        .totBig{
          margin-top: 6px;
          padding-top: 10px;
          border-top: 1px solid rgba(255,255,255,.10);
          display:flex;
          justify-content: space-between;
          font-weight: 950;
          font-size: 16px;
        }

        .notaBox{
          margin-top: 10px;
          padding: 12px;
          border-radius: 14px;
          background: rgba(255,122,0,.12);
          border: 1px solid rgba(255,122,0,.28);
        }
        .notaTitle{
          font-size: 11px;
          font-weight: 950;
          letter-spacing: .06em;
          opacity: .9;
        }
        .notaText{
          margin-top: 6px;
          font-weight: 900;
          font-size: 13px;
          word-break: break-word;
          opacity: .95;
        }

        .boletaActions{
          padding: 12px 14px;
          border-top: 1px dashed rgba(255,255,255,.16);
          display:flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
          background: rgba(0,0,0,.10);
        }
      `}</style>

     

      {/* ✅ BOLETA */}
      <div className="boletaWrap" style={{ marginTop: 12 }}>
        {/* Header */}
        <div className="boletaTop">
          <div className="boletaBrand">
            <div className="boletaMeta">
              <span>
                Tienda: <b>{tiendaId}</b>
              </span>
              <span>
                Pedido: <b>#{pedidoId}</b>
              </span>
              <span>
                Creado: <b>{fmtWhen(pedido?.createdAt) || "—"}</b>
              </span>
              {pedido?.decisionAt ? (
                <span>
                  Decisión: <b>{fmtWhen(pedido?.decisionAt)}</b>
                </span>
              ) : null}
            </div>
          </div>

          <div
            className={`estadoChip st-${String(pedido?.estado || "").toLowerCase()}`}
            title={est.desc || ""}
          >
            <span style={{ fontSize: 16 }}>{est.icon}</span>
            <div className="estadoChipCol">
              <div>{est.title}</div>
              {est.desc ? <div className="sub">{est.desc}</div> : null}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="boletaBody">
          {/* ETA */}
          {etaMin > 0 ? (
            <div className="infoBox" style={{ marginBottom: 12 }}>
              <div className="infoLabel">TIEMPO</div>
              <div className="infoValue">⏱️ Estimado: {etaMin} minutos</div>
              <div className="infoSmall">
                {entregaTipo === "delivery" ? "Entrega aproximada" : "Retiro aproximado"}
              </div>
            </div>
          ) : null}

          {/* Cliente + Entrega */}
          <div className="infoGrid">
            <div className="infoBox">
              <div className="infoLabel">CLIENTE</div>
              <div className="infoValue">{clienteNombre}</div>
              <div className="infoSmall">📱 {clienteContacto}</div>
            </div>

            <div className="infoBox">
              <div className="infoLabel">ENTREGA</div>
              <div className="infoValue">
                {entregaTipo === "delivery" ? "🚚 Delivery" : "🏪 Retiro en el local"}
              </div>
              {entregaTipo === "delivery" ? (
                <>
                  <div className="infoSmall">
                    {barrioNombre ? `📍 ${barrioNombre}` : null}
                    {barrioNombre && direccion ? " · " : null}
                    {direccion ? `🏠 ${direccion}` : null}
                  </div>
                  <div className="infoSmall">Envío: $ {money(envio)}</div>
                </>
              ) : (
                <div className="infoSmall">No se suma envío.</div>
              )}
            </div>
          </div>

          {/* Nota */}
          {pedido?.mensaje ? (
            <div className="notaBox">
              <div className="notaTitle">📝 MENSAJE / NOTA</div>
              <div className="notaText">{String(pedido.mensaje)}</div>
            </div>
          ) : null}

          {/* Items */}
          <div className="boletaSection">
            <div className="boletaH">DETALLE</div>

            <div className="items">
              {(pedido?.items || []).map((it, idx) => {
                const qty = Number(it?.cantidad || 1);
                const name = String(it?.nombreSnapshot || "Item");
                const varTxt = it?.varianteTituloSnapshot ? ` · ${it.varianteTituloSnapshot}` : "";
                const sub = Number(it?.precioUnitSnapshot || 0) * qty;

                return (
                  <div className="itRow" key={`${it?.productoId || "x"}-${idx}`}>
                    <div className="itLeft">
                      <div className="itName">
                        <span style={{ opacity: 0.85, fontWeight: 950 }}>x{qty}</span> · {name}
                        {varTxt}
                      </div>
                      <div className="itMeta">$ {money(Number(it?.precioUnitSnapshot || 0))} c/u</div>
                    </div>
                    <div className="itPrice">$ {money(sub)}</div>
                  </div>
                );
              })}
            </div>

            {/* Totales */}
            <div className="totals">
              <div className="totLine">
                <span className="muted">Subtotal</span>
                <span>$ {money(subtotal)}</span>
              </div>

              {entregaTipo === "delivery" ? (
                <div className="totLine">
                  <span className="muted">Envío</span>
                  <span>$ {money(envio)}</span>
                </div>
              ) : null}

              <div className="totBig">
                <span>TOTAL</span>
                <span>$ {money(totalFinal)}</span>
              </div>

              <div style={{ marginTop: 10, opacity: 0.92, fontWeight: 900, fontSize: 13 }}>
                Pago: <b>{pago.badge}</b> · {pago.line1}
                {pago.line2 ? <span style={{ opacity: 0.9 }}> · {pago.line2}</span> : null}
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
       {/* Footer actions */}
<div className="boletaActions">
  <button className="btnPrimary" type="button" onClick={() => nav(`/t/${tiendaId}`)}>
    ⬅️ VOLVER AL LOCAL
  </button>
</div>

      </div>
    </div>
  );
}
