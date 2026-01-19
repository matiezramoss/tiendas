// PATH: src/ui/CarritoDrawer.jsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { money } from "../lib/money.js";

export default function CarritoDrawer({
  open,
  onClose,
  tienda,
  carrito,
  onRemove,
  onClear,
}) {
  const nav = useNavigate();

  const total = useMemo(() => {
    return (carrito || []).reduce(
      (acc, it) =>
        acc +
        Number(it.precioUnitSnapshot || 0) *
          Number(it.cantidad || 1),
      0
    );
  }, [carrito]);

  if (!open) return null;

  function continuar() {
    if (!tienda) return alert("No hay tienda cargada.");
    if (!carrito?.length) return alert("Carrito vacío.");

    try {
      localStorage.setItem("tienda_checkout", JSON.stringify(tienda));
      localStorage.setItem("carrito_checkout", JSON.stringify(carrito));
    } catch (e) {
      console.warn("No se pudo guardar en localStorage", e);
    }

    onClose?.();

    // ✅ RUTA CORRECTA (con slug)
    nav(`/t/${tienda.slug}/checkout`, {
      state: { tienda, carrito },
    });
  }

  return (
    <div className="drawerBackdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawerTop">
          <div className="drawerTitle">Tu pedido</div>
          <button
            className="drawerClose"
            type="button"
            onClick={onClose}
          >
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
                    {it.varianteTituloSnapshot
                      ? ` · ${it.varianteTituloSnapshot}`
                      : ""}
                  </div>

                  {Array.isArray(it.opcionesSnapshot) &&
                  it.opcionesSnapshot.length ? (
                    <div className="drawerItemOpts">
                      {it.opcionesSnapshot.map((o, idx) => (
                        <span key={idx} className="tag">
                          {o.itemTitulo}
                          {o.precioExtra
                            ? ` (+$${money(o.precioExtra)})`
                            : ""}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="drawerItemRight">
                  <div className="drawerItemQty">
                    x{it.cantidad}
                  </div>
                  <div className="drawerItemPrice">
                    $ {money(
                      Number(it.precioUnitSnapshot || 0) *
                        Number(it.cantidad || 1)
                    )}
                  </div>
                  <button
                    className="drawerRemove"
                    type="button"
                    onClick={() => onRemove?.(it._key)}
                  >
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
            <button
              className="btnGhost"
              type="button"
              onClick={onClear}
            >
              Vaciar
            </button>
            <button
              className="btnPrimary"
              type="button"
              onClick={continuar}
              disabled={!carrito?.length}
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
