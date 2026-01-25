// PATH: src/pages/Checkout.jsx
import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { app } from "../lib/firebase.js";
import { money } from "../lib/money.js";
import { BARRIOS, getBarrioByKey, calcEnvioFromBarrioKey } from "../lib/delivery.js";

/* ===========================
   Helpers horario
   =========================== */
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

function isInRange(min, desde, hasta) {
  const d = parseHHMM(desde);
  const h = parseHHMM(hasta);
  if (d == null || h == null) return true;
  if (d <= h) return min >= d && min <= h;
  return min >= d || min <= h;
}

function getHorarioActual(tienda) {
  const horarios = tienda?.horarios || {};
  const m = nowMinutes();
  const keys = Object.keys(horarios || {});
  if (!keys.length) return { key: "todo", label: "Horario no configurado", ok: true };

  for (const k of keys) {
    const conf = horarios?.[k];
    if (!conf) continue;
    if (isInRange(m, conf?.desde, conf?.hasta)) return { key: k, label: ``, ok: true };
  }
  return { key: "cerrado", label: "Cerrado por horario", ok: false };
}

/* ===========================
   Totales y pago
   =========================== */
function calcTotal(carrito) {
  const items = Array.isArray(carrito) ? carrito : [];
  return items.reduce(
    (acc, it) => acc + Number(it?.precioUnitSnapshot || 0) * Number(it?.cantidad || 1),
    0
  );
}

function calcSena(tienda, totalFinal) {
  const p = tienda?.pago || {};
  const senaFija = Number(p?.senaFija || 0);
  const senaPorcentaje = Number(p?.senaPorcentaje || 0);

  let v = 0;
  if (senaFija > 0) v = senaFija;
  else if (senaPorcentaje > 0) v = Math.round((totalFinal * senaPorcentaje) / 100);
  else v = 0;

  return Math.min(totalFinal, Math.max(0, v));
}

function onlyDigitsPhone(s) {
  return String(s || "").replace(/\D/g, "");
}

export default function Checkout() {
  const nav = useNavigate();
  const loc = useLocation();
  const { slug } = useParams();

  const tiendaState = loc.state?.tienda || null;
  const carritoState = loc.state?.carrito || [];

  const tiendaLS = useMemo(() => {
    if (tiendaState) return tiendaState;
    try {
      const raw = localStorage.getItem("tienda_checkout");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [tiendaState]);

  const carritoLS = useMemo(() => {
    if (carritoState?.length) return carritoState;
    try {
      const raw = localStorage.getItem("carrito_checkout");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, [carritoState]);

  const tienda = tiendaLS;

  // ✅ carrito editable desde checkout
  const [carrito, setCarrito] = useState(() => carritoLS);

  const horario = useMemo(() => getHorarioActual(tienda), [tienda]);

  // ✅ subtotal (sin envío)
  const subtotal = useMemo(() => calcTotal(carrito), [carrito]);

  /* ===========================
     ✅ ENTREGA (retiro/delivery)
     =========================== */
  const [tipoEntrega, setTipoEntrega] = useState("retiro"); // "retiro" | "delivery"
  const [direccion, setDireccion] = useState("");
  const [barrioKey, setBarrioKey] = useState("");

  const barrioSel = useMemo(() => getBarrioByKey(barrioKey), [barrioKey]);

  const envio = useMemo(() => {
    if (tipoEntrega !== "delivery") return 0;
    return calcEnvioFromBarrioKey(barrioKey);
  }, [tipoEntrega, barrioKey]);

  // ✅ total final (con envío si corresponde)
  const totalFinal = useMemo(() => subtotal + envio, [subtotal, envio]);

  // ✅ seña se calcula sobre total FINAL
  const sena = useMemo(() => calcSena(tienda, totalFinal), [tienda, totalFinal]);

  // ✅ mostrar “Seña” SOLO si hay seña configurada y es < totalFinal
  const aceptaSenaFlag = !!tienda?.pago?.aceptaSena;
  const puedeSena = aceptaSenaFlag && sena > 0 && sena < totalFinal;

  // ✅ pago elegido
  const [pagoElegido, setPagoElegido] = useState(puedeSena ? "sena" : "total"); // "sena" | "total" | "efectivo"

  const montoAPagar = useMemo(() => {
    if (!tienda) return 0;

    if (pagoElegido === "efectivo") return 0; // paga al recibir / retirar
    if (pagoElegido === "sena") return sena;
    return totalFinal;
  }, [tienda, totalFinal, sena, pagoElegido]);

  const [cliente, setCliente] = useState({ nombre: "", apellido: "", contacto: "" });
  const [mensaje, setMensaje] = useState("");

  const alias = String(tienda?.pago?.alias || "").trim();
  const cbu = String(tienda?.pago?.cbu || "").trim();

  const [toast, setToast] = useState("");
  function showToast(msg) {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 1400);
  }

  // ✅ NUEVO: candado anti doble tap / doble click
  const [submitting, setSubmitting] = useState(false);

  async function copy(txt, label) {
    if (!txt) return;
    try {
      await navigator.clipboard.writeText(txt);
      showToast(`${label} copiado ✅`);
    } catch {
      showToast("No pude copiar 😕");
    }
  }

  const itemsIncompatibles = useMemo(() => {
    if (!horario.ok) return carrito || [];
    const key = horario.key;
    if (key === "todo") return [];
    return (carrito || []).filter((it) => {
      const tags = Array.isArray(it?.tagsHorarioSnapshot) ? it.tagsHorarioSnapshot : null;
      if (!tags) return false;
      return !tags.includes(key);
    });
  }, [carrito, horario]);

  function persistCarrito(next) {
    setCarrito(next);
    try {
      localStorage.setItem("carrito_checkout", JSON.stringify(next));
    } catch (e) {
      console.warn("No se pudo guardar en localStorage", e);
    }
  }

  function quitarItemByKey(_key) {
    const next = (carrito || []).filter((x) => x._key !== _key);
    persistCarrito(next);
    showToast("Producto eliminado 🧹");
  }

  function limpiarIncompatibles() {
    const badKeys = new Set(itemsIncompatibles.map((x) => x._key));
    const next = (carrito || []).filter((x) => !badKeys.has(x._key));
    persistCarrito(next);
    showToast("Listo ✅ saqué los fuera de horario");
  }

  const requiereDeliveryOk =
    tipoEntrega !== "delivery" || (String(direccion).trim().length >= 6 && !!barrioSel && envio > 0);

  const canConfirm =
    !!tienda &&
    Array.isArray(carrito) &&
    carrito.length > 0 &&
    horario.ok &&
    itemsIncompatibles.length === 0 &&
    String(cliente.nombre).trim() &&
    String(cliente.apellido).trim() &&
    String(cliente.contacto).trim() &&
    requiereDeliveryOk &&
    // Si es efectivo, no obligamos alias/cbu.
    (pagoElegido === "efectivo" || (alias && cbu)) &&
    (pagoElegido === "total" || pagoElegido === "efectivo" || (pagoElegido === "sena" && puedeSena));

  async function confirmar() {
    if (!canConfirm) return;

    // ✅ anti doble confirmación
    if (submitting) return;
    setSubmitting(true);

    try {
	      const db = getFirestore(app);
	      const tiendaId = tienda?.id || tienda?.slug || slug || "chaketortas";
	      // ✅ el carrito "general" de la tienda (TiendaPublica) se guarda como: carrito_<slug>
	      const tiendaSlug = String(tienda?.slug || slug || tiendaId || "").trim();
	      const carritoKey1 = tiendaSlug ? `carrito_${tiendaSlug}` : "";
	      // por si algún día cambiás y usás tiendaId distinto al slug (no molesta)
	      const carritoKey2 = tiendaId && tiendaId !== tiendaSlug ? `carrito_${tiendaId}` : "";

      const entregaSnapshot =
        tipoEntrega === "delivery"
          ? {
              tipo: "delivery",
              direccion: String(direccion).trim(),
              barrioKey: String(barrioSel?.key || ""),
              barrioNombre: String(barrioSel?.nombre || ""),
              envio: Number(envio || 0),
            }
          : {
              tipo: "retiro",
              direccion: "",
              barrioKey: "",
              barrioNombre: "",
              envio: 0,
            };

      // ✅ IMPORTANTÍSIMO: campos “planos” (compatibles con OwnerPanel / filtros / WA)
      const entregaTipo = entregaSnapshot.tipo; // "delivery" | "retiro"

      const payload = {
        tiendaIdSnapshot: String(tiendaId),
        estado: "pendiente",
        cliente: {
          nombre: String(cliente.nombre).trim(),
          apellido: String(cliente.apellido).trim(),
          contacto: String(cliente.contacto).trim(),
          contactoDigits: onlyDigitsPhone(cliente.contacto),
        },
        mensaje: String(mensaje || "").trim(),

        // ✅ snapshot completo (por si querés usarlo en tracking / histórico)
        entregaSnapshot,

        // ✅ campos planos (esto arregla tu problema de “me aparece retiro”)
        entregaTipo,
        direccionSnapshot: entregaTipo === "delivery" ? String(direccion).trim() : "",
        barrioKeySnapshot: entregaTipo === "delivery" ? String(barrioSel?.key || "") : "",
        barrioNombreSnapshot: entregaTipo === "delivery" ? String(barrioSel?.nombre || "") : "",
        envioPrecioSnapshot: entregaTipo === "delivery" ? Number(envio || 0) : 0,

        // ✅ Totales
        subtotalSnapshot: Number(subtotal || 0),
        totalFinalSnapshot: Number(totalFinal || 0),

        // compat (si antes “totalSnapshot” era el total sin envío)
        totalSnapshot: Number(subtotal || 0),

        // (si ya lo estabas usando en otros lados, lo dejamos)
        envioSnapshot: Number(envio || 0),

        items: carrito.map((it) => ({
          productoId: it.productoId || "",
          nombreSnapshot: it.nombreSnapshot || "",
          varianteKey: it.varianteKey || "",
          varianteTituloSnapshot: it.varianteTituloSnapshot || "",
          precioUnitSnapshot: Number(it.precioUnitSnapshot || 0),
          cantidad: Number(it.cantidad || 1),
          opcionesSnapshot: Array.isArray(it.opcionesSnapshot) ? it.opcionesSnapshot : [],
          // ✅ FIX: NUNCA mandar undefined a Firestore
          ...(Array.isArray(it.tagsHorarioSnapshot) ? { tagsHorarioSnapshot: it.tagsHorarioSnapshot } : {}),
        })),

        pagoElegido, // "sena" | "total" | "efectivo"
        montoAPagarSnapshot: Number(montoAPagar || 0),
        senaSnapshot: Number(sena || 0),

        createdAt: serverTimestamp(),
        decisionAt: null,
        stockProcesado: false,
      };

      const ref = collection(db, "tiendas", String(tiendaId), "pedidos");
      const docRef = await addDoc(ref, payload);

      try {
        // guardamos el último pedido (si te sirve para algo)
        localStorage.setItem("pedido_last_id", docRef.id);

        // ✅ compra confirmada => vaciar carrito persistido (checkout)
        localStorage.removeItem("carrito_checkout");
        localStorage.removeItem("tienda_checkout");

        // ✅ MUY IMPORTANTE: vaciar también el carrito general de la tienda
        // (TiendaPublica lo guarda como: carrito_<slug>)
        if (carritoKey1) localStorage.removeItem(carritoKey1);
        if (carritoKey2) localStorage.removeItem(carritoKey2);

        // ✅ además, dejalo explícitamente vacío por si tu app lee "carrito_checkout"
        localStorage.setItem("carrito_checkout", "[]");

        // ✅ vaciar carrito en pantalla (estado del checkout)
        setCarrito([]);
      } catch (e) {
        console.warn("No se pudo actualizar localStorage", e);
      }

      showToast("Pedido creado ✅");
      nav(`/t/${tiendaId}/pedido/${docRef.id}`, { state: { tiendaId } });
    } catch (err) {
      console.error("Error al confirmar pedido:", err);
      showToast("No pude confirmar 😕 probá de nuevo");
    } finally {
      setSubmitting(false);
    }
  }

  // ✅ CAMBIO INTEGRADO: helper para mostrar extras/opciones elegidas
  function renderExtrasLines(it) {
    const ops = Array.isArray(it?.opcionesSnapshot) ? it.opcionesSnapshot : [];
    if (!ops.length) return null;

    // Agrupamos por grupoTitulo (o grupoKey fallback)
    const byGroup = new Map();
    for (const o of ops) {
      const g = String(o?.grupoTitulo || o?.grupoKey || "Opciones");
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g).push(o);
    }

    const groups = Array.from(byGroup.entries());

    return (
      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
        {groups.map(([gTitle, arr]) => (
          <div key={gTitle} style={{ fontSize: 12, opacity: 0.85 }}>
            <span style={{ fontWeight: 900, opacity: 0.95 }}>{gTitle}:</span>{" "}
            {arr
              .map((o) => {
                const t = String(o?.itemTitulo || o?.itemKey || "—");
                const ex = Number(o?.precioExtra || 0);
                return ex > 0 ? `${t} (+$ ${money(ex)})` : t;
              })
              .join(" · ")}
          </div>
        ))}
      </div>
    );
  }

  if (!tienda) {
    return <div className="loading">No hay tienda cargada. Volvé a la tienda y tocá “Continuar”.</div>;
  }

  return (
    <div className="checkoutWrap">
      {toast ? (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: 18,
            transform: "translateX(-50%)",
            zIndex: 9999,
            background: "rgba(20,20,20,.92)",
            border: "1px solid rgba(255,255,255,.10)",
            padding: "10px 12px",
            borderRadius: 14,
            color: "white",
            fontWeight: 900,
            boxShadow: "0 18px 60px rgba(0,0,0,.55)",
          }}
        >
          {toast}
        </div>
      ) : null}

      <div style={{ marginBottom: 10, opacity: 0.9, display: "flex", justifyContent: "space-between" }}>
        <b></b>
        <span style={{ fontWeight: 900 }}>{horario.label}</span>
      </div>

      {!horario.ok ? (
        <div className="miniCard" style={{ marginBottom: 12 }}>
          <b>Ahora está cerrado.</b> No se puede confirmar pedidos en este horario.
        </div>
      ) : null}

      {itemsIncompatibles.length ? (
        <div className="miniCard" style={{ marginBottom: 12 }}>
          <b>Hay productos fuera de horario.</b> Sacalos del carrito para continuar.
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btnGhost" type="button" onClick={() => nav(-1)}>
              Volver
            </button>
            <button className="btnPrimary" type="button" onClick={limpiarIncompatibles}>
              Sacar fuera de horario
            </button>
          </div>
        </div>
      ) : null}

      {/* Resumen */}
      <div className="miniCard" style={{ marginBottom: 12 }}>
        <h4 id="tupedido">TU PEDIDO</h4>

        {carrito?.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {carrito.map((it) => {
              const bad = itemsIncompatibles.some((x) => x._key === it._key);
              return (
                <div key={it._key} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ opacity: 0.95 }}>
                    <b>
                      {it.nombreSnapshot}
                      {it.varianteTituloSnapshot ? ` · ${it.varianteTituloSnapshot}` : ""}
                      {bad ? <span style={{ marginLeft: 8, opacity: 0.8 }}>⛔</span> : null}
                    </b>

                    <div style={{ opacity: 0.75, fontSize: 12 }}>
                      x{it.cantidad} · $ {money(it.precioUnitSnapshot)}
                    </div>

                    {/* ✅ CAMBIO INTEGRADO: mostrar extras elegidos */}
                    {renderExtrasLines(it)}

                    <button
                      type="button"
                      className="drawerRemove"
                      style={{ marginTop: 6 }}
                      onClick={() => quitarItemByKey(it._key)}
                    >
                      Quitar
                    </button>
                  </div>

                  <div style={{ fontWeight: 900 }}>
                    $ {money(Number(it.precioUnitSnapshot || 0) * Number(it.cantidad || 1))}
                  </div>
                </div>
              );
            })}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <b>Subtotal</b>
              <b>$ {money(subtotal)}</b>
            </div>

            {tipoEntrega === "delivery" ? (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, opacity: 0.95 }}>
                <b>Envío</b>
                <b>$ {money(envio)}</b>
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <b>Total</b>
              <b>$ {money(totalFinal)}</b>
            </div>
          </div>
        ) : (
          <div style={{ opacity: 0.8 }}>Carrito vacío</div>
        )}
      </div>

      {/* Entrega */}
      <div className="miniCard" style={{ marginBottom: 12 }}>
        <h4>Entrega</h4>

        <div className="chipRow" style={{ marginTop: 8 }}>
          <button
            type="button"
            className={`chip ${tipoEntrega === "retiro" ? "on" : ""}`}
            onClick={() => setTipoEntrega("retiro")}
          >
            Retiro
          </button>

          <button
            type="button"
            className={`chip ${tipoEntrega === "delivery" ? "on" : ""}`}
            onClick={() => setTipoEntrega("delivery")}
          >
            Delivery
          </button>
        </div>

        {tipoEntrega === "delivery" ? (
          <div style={{ marginTop: 12 }}>
            <input
              className="input"
              style={{ width: "100%", minWidth: 0, boxSizing: "border-box" }}
              placeholder="Dirección (calle y altura) *"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
            />

            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.85, marginBottom: 8 }}>Barrio *</div>

              <select
                className="input"
                value={barrioKey}
                onChange={(e) => setBarrioKey(e.target.value)}
                style={{ width: "100%", margin: 0 }}
              >
                <option value="">Elegí un barrio…</option>
                {BARRIOS.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.nombre} · $ {money(b.precio)}
                  </option>
                ))}
              </select>

              {barrioSel ? (
                <div style={{ marginTop: 10, opacity: 0.9, fontWeight: 900 }}>
                  Envío: $ {money(envio)} · Total: $ {money(totalFinal)}
                </div>
              ) : (
                <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
                  * Elegí el barrio para calcular el envío.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>
            Retirás en el local. No se suma envío.
          </div>
        )}
      </div>

      {/* Datos cliente */}
      <div className="miniCard" style={{ marginBottom: 12 }}>
        <h4>Datos</h4>

        <div
          className="__datosGridFix"
          style={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            width: "100%",
            maxWidth: "100%",
            alignItems: "stretch",
          }}
        >
          <input
            className="input"
            style={{ width: "100%", minWidth: 0, boxSizing: "border-box" }}
            placeholder="Nombre *"
            value={cliente.nombre}
            onChange={(e) => setCliente((p) => ({ ...p, nombre: e.target.value }))}
          />
          <input
            className="input"
            style={{ width: "100%", minWidth: 0, boxSizing: "border-box" }}
            placeholder="Apellido *"
            value={cliente.apellido}
            onChange={(e) => setCliente((p) => ({ ...p, apellido: e.target.value }))}
          />
        </div>

        <input
          className="input"
          style={{ marginTop: 12, width: "100%", minWidth: 0, boxSizing: "border-box" }}
          placeholder="Contacto (WhatsApp) *"
          value={cliente.contacto}
          onChange={(e) => setCliente((p) => ({ ...p, contacto: e.target.value }))}
        />

        <textarea
          className="input"
          style={{
            marginTop: 12,
            width: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            minHeight: 120,
            resize: "vertical",
          }}
          placeholder="Mensaje para el local (opcional)"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
        />

        <style>{`
          @media (max-width: 520px){
            .miniCard .__datosGridFix { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>

      {/* Pago */}
      <div className="miniCard" style={{ marginBottom: 12 }}>
        <h4>Pago</h4>

        <div className="chipRow" style={{ marginTop: 8 }}>
          {puedeSena ? (
            <button
              type="button"
              className={`chip ${pagoElegido === "sena" ? "on" : ""}`}
              onClick={() => setPagoElegido("sena")}
            >
              Seña · $ {money(sena)}
            </button>
          ) : null}

          <button
            type="button"
            className={`chip ${pagoElegido === "total" ? "on" : ""}`}
            onClick={() => setPagoElegido("total")}
          >
            Total · $ {money(totalFinal)}
          </button>

          <button
            type="button"
            className={`chip ${pagoElegido === "efectivo" ? "on" : ""}`}
            onClick={() => setPagoElegido("efectivo")}
          >
            Efectivo
          </button>
        </div>

        {!puedeSena && aceptaSenaFlag ? (
          <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>
            {/* * Seña habilitada pero no configurada (senaFija / senaPorcentaje). Por eso no aparece. */}
          </div>
        ) : null}

        {pagoElegido === "efectivo" ? (
          <div style={{ marginTop: 12, opacity: 0.9, fontSize: 13 }}>
            Pagás en efectivo al {tipoEntrega === "delivery" ? "recibir" : "retirar"}.
            <div style={{ marginTop: 8, fontWeight: 900 }}>Total: $ {money(totalFinal)}</div>
          </div>
        ) : (
          <div style={{ marginTop: 12, opacity: 0.9 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 900 }}>Alias</div>
                <div style={{ opacity: 0.85 }}>{alias || "—"}</div>
              </div>
              <button className="btnGhost" type="button" onClick={() => copy(alias, "Alias")} disabled={!alias}>
                Copiar
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 10 }}>
              <div>
                <div style={{ fontWeight: 900 }}>CBU</div>
                <div style={{ opacity: 0.85 }}>{cbu || "—"}</div>
              </div>
              <button className="btnGhost" type="button" onClick={() => copy(cbu, "CBU")} disabled={!cbu}>
                Copiar
              </button>
            </div>

            <div style={{ marginTop: 12, fontWeight: 900 }}>A pagar ahora: $ {money(montoAPagar)}</div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button className="btnGhost" type="button" onClick={() => nav(-1)} disabled={submitting}>
          Volver
        </button>

        {/* ✅ ahora bloquea doble confirmación */}
        <button className="btnPrimary" type="button" onClick={confirmar} disabled={!canConfirm || submitting}>
          {submitting ? "Confirmando..." : "Confirmar compra"}
        </button>
      </div>

      {tipoEntrega === "delivery" && !requiereDeliveryOk ? (
        <div style={{ marginTop: 12, opacity: 0.75, fontSize: 12 }}>
          * Para delivery necesitás <b>dirección</b> y <b>barrio</b>.
        </div>
      ) : null}
    </div>
  );
}
