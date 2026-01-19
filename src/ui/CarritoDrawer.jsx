// PATH: src/ui/CarritoDrawer.jsx
import React, { useMemo } from "react";
import { money } from "../lib/money.js";

export default function CarritoDrawer({ open, onClose, carrito, onRemove, onClear }) {
  const total = useMemo(() => {
    return (carrito || []).reduce((acc, it) => acc + Number(it.precioUnitSnapshot || 0) * Number(it.cantidad || 1), 0);
  }, [carrito]);

  if (!open) return null;

  return (
    <div className="drawerBackdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawerTop">
          <div className="drawerTitle">Tu pedido</div>
          <button className="drawerClose" type="button" onClick={onClose}>✕</button>
        </div>

        <div className="drawerList">
          {(carrito || []).length === 0 ? (
            <div className="drawerEmpty">Carrito vacío</div>
          ) : (
            carrito.map((it) => (
              <div className="drawerItem" key={it._key}>
                <div className="drawerItemMain">
                  <div className="drawerItemName">
                    {it.nombreSnapshot} · {it.varianteTituloSnapshot}
                  </div>
                  {Array.isArray(it.opcionesSnapshot) && it.opcionesSnapshot.length ? (
                    <div className="drawerItemOpts">
                      {it.opcionesSnapshot.map((o, idx) => (
                        <span key={idx} className="tag">
                          {o.itemTitulo}{o.precioExtra ? ` (+$${money(o.precioExtra)})` : ""}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="drawerItemRight">
                  <div className="drawerItemQty">x{it.cantidad}</div>
                  <div className="drawerItemPrice">$ {money(Number(it.precioUnitSnapshot || 0) * Number(it.cantidad || 1))}</div>
                  <button className="drawerRemove" type="button" onClick={() => onRemove?.(it._key)}>Eliminar</button>
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
            <button className="btnGhost" type="button" onClick={onClear}>Vaciar</button>
            <button className="btnPrimary" type="button" onClick={() => alert("Checkout lo conectamos en el próximo paso")}>
              Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
