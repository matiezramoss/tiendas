// PATH: src/pages/Checkout.jsx
import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { app } from "../lib/firebase.js";
import { money } from "../lib/money.js";

function parseHHMM(s) {
  const m = String(s || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Math.max(0, Math.min(23, Number(m[1])));
  const mm = Math.max(0, Math.min(59, Number(m[2])));
  return hh * 60 + mm;
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function getHorarioActual(tienda) {
  const modo = tienda?.horarios?.modo || "simple";
  if (modo !== "simple") return { key: "todo", label: "Todo el día", ok: true };

  const comidaDesde = parseHHMM(tienda?.horarios?.comidaDesde ?? "20:00");
  const kioscoHasta = parseHHMM(tienda?.horarios?.kioscoHasta ?? "19:59");
  const n = nowMinutes();

  // fallback si falta algo
  if (comidaDesde == null || kioscoHasta == null) {
    return { key: "todo", label: "Horario no configurado", ok: true };
  }

  // “simple”: antes de comidaDesde => kiosco, desde comidaDesde => comida
  if (n >= comidaDesde) return { key: "comida", label: "Comida", ok: true };
  if (n <= kioscoHasta) return { key: "kiosco", label: "Kiosco", ok: true };

  // caso raro si te dejan un hueco entre kioscoHasta y comidaDesde
  return { key: "cerrado", label: "Cerrado por horario", ok: false };
}

function calcTotal(carrito) {
  const items = Array.isArray(carrito) ? carrito : [];
  let sum = 0;
  for (const it of items) {
    const qty = Number(it?.cantidad || 1);
    const unit = Number(it?.precioUnitSnapshot || 0);
    sum += unit * qty;
  }
  return sum;
}

function calcMontoAPagar(tienda, total, pagoElegido) {
  const p = tienda?.pago || {};
  if (pagoElegido === "total") return total;

  // seña
  const senaFija = Number(p?.senaFija || 0);
  const senaPorcentaje = Number(p?.senaPorcentaje || 0);

  let v = 0;
  if (senaFija > 0) v = senaFija;
  else if (senaPorcentaje > 0) v = Math.round((total * senaPorcentaje) / 100);
  else v = 0;

  // nunca más que el total
  return Math.min(total, Math.max(0, v));
}

export default function Checkout() {
  const nav = useNavigate();
  const loc = useLocation();

  // Esperamos que vengas con: navigate("/checkout", { state: { tienda, carrito } })
  const tienda = loc.state?.tienda || null;
  const carrito = loc.state?.carrito || [];

  // Si no vinieron por state, intentamos localStorage (opcional)
  // (si vos no lo usás, no pasa nada)
  const tiendaLS = useMemo(() => {
    if (tienda) return tienda;
    try {
      const raw = localStorage.getItem("tienda_checkout");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [tienda]);

  const carritoLS = useMemo(() => {
    if (carrito?.length) return carrito;
    try {
      const raw = localStorage.getItem("carrito_checkout");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, [carrito]);

  const tiendaFinal = tiendaLS;
  const carritoFinal = carritoLS;

  const horario = useMemo(() => getHorarioActual(tiendaFinal), [tiendaFinal]);

  const total = useMemo(() => calcTotal(carritoFinal), [carritoFinal]);

  const aceptaSena = !!tiendaFinal?.pago?.aceptaSena;
  const [pagoElegido, setPagoElegido] = useState(aceptaSena ? "sena" : "total");

  const montoAPagar = useMemo(() => {
    return calcMontoAPagar(tiendaFinal, total, pagoElegido);
  }, [tiendaFinal, total, pagoElegido]);

  const [cliente, setCliente] = useState({ nombre: "", apellido: "", contacto: "" });
  const [mensaje, setMensaje] = useState("");

  const alias = String(tiendaFinal?.pago?.alias || "").trim();
  const cbu = String(tiendaFinal?.pago?.cbu || "").trim();

  const itemsIncompatibles = useMemo(() => {
    // Si tu producto tiene tagsHorario en carrito, lo evaluamos.
    // (en tu snapshot actual no estás guardando tagsHorario, así que esto solo sirve si lo agregás)
    // Igual dejamos lógica lista.
    const key = horario.key;
    if (key === "todo") return [];
    if (key === "cerrado") return carritoFinal;

    return (carritoFinal || []).filter((it) => {
      const tags = Array.isArray(it?.tagsHorarioSnapshot) ? it.tagsHorarioSnapshot : null;
      if (!tags) return false; // si no hay tags, lo dejamos pasar
      return !tags.includes(key);
    });
  }, [carritoFinal, horario]);

  const canConfirm =
    !!tiendaFinal &&
    Array.isArray(carritoFinal) &&
    carritoFinal.length > 0 &&
    horario.ok &&
    itemsIncompatibles.length === 0 &&
    String(cliente.nombre).trim() &&
    String(cliente.apellido).trim() &&
    String(cliente.contacto).trim() &&
    alias &&
    cbu &&
    (pagoElegido === "total" || (pagoElegido === "sena" && aceptaSena));

  async function copy(txt) {
    try {
      await navigator.clipboard.writeText(txt);
      alert("Copiado ✅");
    } catch {
      alert("No pude copiar. Copialo manual.");
    }
  }

  async function confirmar() {
    if (!canConfirm) return;

    const db = getFirestore(app);

    // si tu docId de tienda es el slug, genial.
    // Si no, guardá tiendaFinal.id y usalo acá.
    const tiendaId = tiendaFinal?.id || tiendaFinal?.slug || "chaketortas";

    const payload = {
      estado: "pendiente",
      cliente: {
        nombre: String(cliente.nombre).trim(),
        apellido: String(cliente.apellido).trim(),
        contacto: String(cliente.contacto).trim(),
      },
      mensaje: String(mensaje || "").trim(),
      items: carritoFinal.map((it) => ({
        productoId: it.productoId || "",
        nombreSnapshot: it.nombreSnapshot || "",
        varianteKey: it.varianteKey || "",
        varianteTituloSnapshot: it.varianteTituloSnapshot || "",
        precioUnitSnapshot: Number(it.precioUnitSnapshot || 0),
        cantidad: Number(it.cantidad || 1),
        opcionesSnapshot: Array.isArray(it.opcionesSnapshot) ? it.opcionesSnapshot : [],
      })),
      pagoElegido,
      totalSnapshot: Number(total || 0),
      montoAPagarSnapshot: Number(montoAPagar || 0),
      createdAt: serverTimestamp(),
      decisionAt: null,
      stockProcesado: false,
    };

    const ref = collection(db, "tiendas", String(tiendaId), "pedidos");
    const doc = await addDoc(ref, payload);

    // opcional: guardar para tracking
    try {
      localStorage.setItem("pedido_last_id", doc.id);
      localStorage.removeItem("carrito_checkout");
    } catch (e) {
  console.warn("No se pudo guardar en localStorage", e);
}


    alert("Pedido creado ✅ (pendiente)");
    nav(`/pedido/${doc.id}`, { state: { tiendaId } });
  }

  if (!tiendaFinal) {
    return (
      <div className="loading">
        No hay tienda cargada. Volvé a la tienda y tocá “Finalizar”.
      </div>
    );
  }

  return (
    <div style={{ padding: 14 }}>
      <div style={{ marginBottom: 10, opacity: 0.9 }}>
        <b>Checkout</b> · Horario: {horario.label}
      </div>

      {!horario.ok ? (
        <div className="miniCard" style={{ marginBottom: 12 }}>
          <b>Ahora está cerrado.</b> No se puede confirmar pedidos en este horario.
        </div>
      ) : null}

      {itemsIncompatibles.length ? (
        <div className="miniCard" style={{ marginBottom: 12 }}>
          <b>Hay productos fuera de horario.</b> Sacalos del carrito para continuar.
        </div>
      ) : null}

      {/* Resumen */}
      <div className="miniCard" style={{ marginBottom: 12 }}>
        <h4>Tu pedido</h4>
        {carritoFinal?.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {carritoFinal.map((it, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ opacity: 0.95 }}>
                  <b>{it.nombreSnapshot}</b>
                  {it.varianteTituloSnapshot ? ` · ${it.varianteTituloSnapshot}` : ""}
                  <div style={{ opacity: 0.75, fontSize: 12 }}>
                    x{it.cantidad} · $ {money(it.precioUnitSnapshot)}
                  </div>
                </div>
                <div style={{ fontWeight: 900 }}>
                  $ {money(Number(it.precioUnitSnapshot || 0) * Number(it.cantidad || 1))}
                </div>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
              <b>Total</b>
              <b>$ {money(total)}</b>
            </div>
          </div>
        ) : (
          <div style={{ opacity: 0.8 }}>Carrito vacío</div>
        )}
      </div>

      {/* Datos cliente */}
      <div className="miniCard" style={{ marginBottom: 12 }}>
        <h4>Datos</h4>

        <div className="row" style={{ gap: 10 }}>
          <input
            className="input"
            placeholder="Nombre *"
            value={cliente.nombre}
            onChange={(e) => setCliente((p) => ({ ...p, nombre: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Apellido *"
            value={cliente.apellido}
            onChange={(e) => setCliente((p) => ({ ...p, apellido: e.target.value }))}
          />
        </div>

        <input
          className="input"
          style={{ marginTop: 10 }}
          placeholder="Contacto (WhatsApp) *"
          value={cliente.contacto}
          onChange={(e) => setCliente((p) => ({ ...p, contacto: e.target.value }))}
        />

        <textarea
          className="input"
          style={{ marginTop: 10, minHeight: 90 }}
          placeholder="Mensaje para el local (opcional)"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
        />
      </div>

      {/* Pago */}
      <div className="miniCard" style={{ marginBottom: 12 }}>
        <h4>Pago</h4>

        <div className="chipRow" style={{ marginTop: 8 }}>
          {aceptaSena ? (
            <button
              type="button"
              className={`chip ${pagoElegido === "sena" ? "on" : ""}`}
              onClick={() => setPagoElegido("sena")}
            >
              Seña · $ {money(calcMontoAPagar(tiendaFinal, total, "sena"))}
            </button>
          ) : null}

          <button
            type="button"
            className={`chip ${pagoElegido === "total" ? "on" : ""}`}
            onClick={() => setPagoElegido("total")}
          >
            Total · $ {money(total)}
          </button>
        </div>

        <div style={{ marginTop: 12, opacity: 0.9 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 900 }}>Alias</div>
              <div style={{ opacity: 0.85 }}>{alias || "—"}</div>
            </div>
            <button className="btnGhost" type="button" onClick={() => copy(alias)} disabled={!alias}>
              Copiar
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 10 }}>
            <div>
              <div style={{ fontWeight: 900 }}>CBU</div>
              <div style={{ opacity: 0.85 }}>{cbu || "—"}</div>
            </div>
            <button className="btnGhost" type="button" onClick={() => copy(cbu)} disabled={!cbu}>
              Copiar
            </button>
          </div>

          <div style={{ marginTop: 12, fontWeight: 900 }}>
            A pagar ahora: $ {money(montoAPagar)}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button className="btnGhost" type="button" onClick={() => nav(-1)}>
          Volver
        </button>
        <button className="btnPrimary" type="button" onClick={confirmar} disabled={!canConfirm}>
          Confirmar compra
        </button>
      </div>
    </div>
  );
}
