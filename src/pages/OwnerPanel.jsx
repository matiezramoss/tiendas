// PATH: src/pages/OwnerPanel.jsx
import React, { useEffect, useState } from "react";
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

function pagoLabel(pedido) {
  const pago = String(pedido?.pagoElegido || "").toLowerCase();
  if (pago === "sena") return `Seña · $${money(Number(pedido?.montoAPagarSnapshot || 0))}`;
  if (pago === "total") return `Total · $${money(Number(pedido?.montoAPagarSnapshot || 0))}`;
  if (pago === "efectivo") return "Efectivo · paga al retirar";
  return "—";
}

function PedidoCard({ pedido, onAction }) {
  const total = calcTotalPedido(pedido);

  return (
    <div className="miniCard" style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 14 }}>
            {pedido?.cliente?.nombre || ""} {pedido?.cliente?.apellido || ""}
          </div>
          <div style={{ opacity: 0.8, fontSize: 12 }}>
            {pedido?.cliente?.contacto || "—"} · {fmtWhen(pedido?.createdAt)}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 900 }}>$ {money(total)}</div>
          <div style={{ opacity: 0.8, fontSize: 12 }}>
            Pago: <b>{pagoLabel(pedido)}</b>
          </div>
        </div>
      </div>

      {pedido?.mensaje ? (
        <div style={{ marginTop: 10, opacity: 0.9, fontSize: 13 }}>
          “{pedido.mensaje}”
        </div>
      ) : null}

      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
        {(pedido?.items || []).map((it, idx) => (
          <div
            key={`${it?.productoId || "x"}-${idx}`}
            style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}
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
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
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
      </div>

      <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
        Estado: <b>{pedido?.estado}</b>
        {Number(pedido?.etaMin || 0) > 0 ? ` · Tiempo estimado ${pedido.etaMin}m` : ""}
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
        <h3 style={{ margin: "14px 0 10px" }}>⚫ Pedidos pasados ({pasados.length})</h3>
        {pasados.length ? (
          pasados.map((p) => <PedidoCard key={p.id} pedido={p} onAction={onAction} />)
        ) : (
          <div style={{ opacity: 0.7 }}>Todavía no hay pasados.</div>
        )}
      </div>
    </div>
  );
}
