// PATH: src/ui/CarritoDrawer.jsx
import React, { useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { money } from "../lib/money.js";

function lockBodyScroll() {
  const y = window.scrollY || window.pageYOffset || 0;

  // guardamos para restaurar
  document.body.dataset.scrollY = String(y);

  // 🔥 el fix real para iOS: congelar body donde está
  document.body.style.position = "fixed";
  document.body.style.top = `-${y}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

function unlockBodyScroll() {
  const y = Number(document.body.dataset.scrollY || "0");

  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";

  delete document.body.dataset.scrollY;

  // restaurar scroll
  window.scrollTo(0, y);
}

export default function CarritoDrawer({
  open,
  onClose,
  tienda,
  carrito,
  onRemove,
  onClear,
  onCheckout,
}) {
  const nav = useNavigate();

  const total = useMemo(() => {
    return (carrito || []).reduce(
      (acc, it) => acc + Number(it?.precioUnitSnapshot || 0) * Number(it?.cantidad || 1),
      0
    );
  }, [carrito]);

  // ✅ lock body scroll sin “salto al top”
  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [open]);

  if (!open) return null;

  function continuar() {
    if (!tienda) return alert("No hay tienda cargada.");
    if (!carrito?.length) return alert("Carrito vacío.");

    try {
      localStorage.setItem("tienda_checkout", JSON.stringify(tienda));
      localStorage.setItem("carrito_checkout", JSON.stringify(carrito));
    } catch (e) {
      console.log("storage error", e);
    }

    // ✅ primero navegamos
    if (typeof onCheckout === "function") {
      onCheckout();
    } else {
      const slug = String(tienda?.slug || "").trim();
      if (!slug) return alert("Falta tienda.slug para ir a checkout.");
      nav(`/t/${slug}/checkout`, { state: { tienda, carrito } });
    }

    // ✅ cerramos después
    onClose?.();
  }

  const ui = (
    <div className="drawerBackdrop" onClick={onClose} role="presentation">
      <div className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="drawerTop">
          <div className="drawerTitle">Tu pedido</div>
          <button className="drawerClose" type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="drawerList">
          {(carrito || []).length === 0 ? (
            <div className="drawerEmpty">Carrito vacío</div>
          ) : (
            carrito.map((it) => (
              <div className="drawerItem" key={it._key}>
                <div className="drawerItemMain">
                  <div className="drawerItemName">
                    {it.nombreSnapshot}
                    {it.varianteTituloSnapshot ? ` · ${it.varianteTituloSnapshot}` : ""}
                  </div>

                  {Array.isArray(it.opcionesSnapshot) && it.opcionesSnapshot.length ? (
                    <div className="drawerItemOpts">
                      {it.opcionesSnapshot.map((o, idx) => (
                        <span key={idx} className="tag">
                          {o.itemTitulo}
                          {o.precioExtra ? ` (+$${money(o.precioExtra)})` : ""}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="drawerItemRight">
                  <div className="drawerItemQty">x{it.cantidad}</div>
                  <div className="drawerItemPrice">
                    $ {money(Number(it.precioUnitSnapshot || 0) * Number(it.cantidad || 1))}
                  </div>
                  <button className="drawerRemove" type="button" onClick={() => onRemove?.(it._key)}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="drawerBottom">
          <div className="drawerTotal">
            <span>Total</span>
            <b>$ {money(total)}</b>
          </div>

          <div className="drawerActions">
            <button className="btnGhost" type="button" onClick={onClear}>
              Vaciar
            </button>
            <button className="btnPrimary" type="button" onClick={continuar} disabled={!carrito?.length}>
              Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ✅ CLAVE: el drawer va en portal (se abre bien sin importar el scroll)
  return createPortal(ui, document.body);
}
