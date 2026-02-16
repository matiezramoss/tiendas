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
      nav(`/${slug}/checkout`, { state: { tienda, carrito } });
    }

    // ✅ cerramos después
    onClose?.();
  }

  const ui = (
    <div className="drawerBackdrop" onClick={onClose} role="presentation">
      <div className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {/* ✅ estilos locales SOLO para el drawer (no rompe tu tema global) */}
        <style>{`
          .drawerBackdrop{
            position: fixed;
            inset: 0;
            z-index: 9999;
            background: rgba(0,0,0,.55);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            display:flex;
            justify-content:center;
            align-items:flex-end;
          }

          /* ✅ Importante: usar dvh para mobile (Chrome/Android) */
          .drawer{
            width: min(760px, 100%);
            height: 100dvh;                /* 👈 CLAVE */
            max-height: 100dvh;            /* 👈 CLAVE */
            display:flex;
            flex-direction:column;         /* 👈 CLAVE */
            background: rgba(10,10,10,.92);
            border: 1px solid rgba(255,255,255,.12);
            border-radius: 18px 18px 0 0;
            overflow: hidden;
            box-shadow: 0 30px 120px rgba(0,0,0,.6);
          }

          .drawerTop{
            flex: 0 0 auto;
            display:flex;
            justify-content:space-between;
            align-items:center;
            padding: 14px 14px 12px;
            border-bottom: 1px solid rgba(255,255,255,.10);
            background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
          }
          .drawerTitle{
            font-weight: 950;
            font-size: 18px;
            letter-spacing: .02em;
          }
          .drawerClose{
            border: 0;
            background: transparent;
            color: inherit;
            font-size: 20px;
            padding: 8px 10px;
            border-radius: 12px;
            cursor: pointer;
          }

          /* ✅ El scroll va ACÁ */
          .drawerList{
            flex: 1 1 auto;                 /* 👈 CLAVE */
            overflow-y: auto;               /* 👈 CLAVE */
            -webkit-overflow-scrolling: touch;
            padding: 14px;
            padding-bottom: calc(130px + env(safe-area-inset-bottom)); /* 👈 deja lugar al footer */
          }

          .drawerEmpty{
            padding: 18px 6px;
            opacity: .8;
            font-weight: 800;
          }

          .drawerItem{
            display:flex;
            justify-content:space-between;
            gap: 12px;
            padding: 12px 12px;
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,.10);
            background: rgba(255,255,255,.04);
            margin-bottom: 12px;
          }

          .drawerItemMain{ min-width: 0; flex: 1; }
          .drawerItemName{
            font-weight: 950;
            font-size: 16px;
            line-height: 1.2;
            word-break: break-word;
          }
          .drawerItemOpts{
            margin-top: 8px;
            display:flex;
            flex-wrap: wrap;
            gap: 8px;
          }
          .tag{
            display:inline-flex;
            align-items:center;
            padding: 7px 10px;
            border-radius: 999px;
            border: 1px solid rgba(255,140,0,.35);
            background: rgba(255,140,0,.10);
            font-weight: 800;
            font-size: 12px;
            opacity: .95;
          }

          .drawerItemRight{
            flex: 0 0 auto;
            display:flex;
            flex-direction:column;
            align-items:flex-end;
            gap: 6px;
            text-align:right;
          }
          .drawerItemQty{
            opacity: .75;
            font-weight: 900;
          }
          .drawerItemPrice{
            font-weight: 950;
            font-size: 18px;
            white-space: nowrap;
          }
          .drawerRemove{
            border: 0;
            background: transparent;
            color: inherit;
            opacity: .75;
            text-decoration: underline;
            font-weight: 900;
            padding: 6px 0;
            cursor: pointer;
          }

          /* ✅ Footer siempre visible */
          .drawerBottom{
            flex: 0 0 auto;
            position: sticky;               /* 👈 CLAVE */
            bottom: 0;                      /* 👈 CLAVE */
            z-index: 5;
            border-top: 1px solid rgba(255,255,255,.12);
            background: rgba(10,10,10,.92);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            padding: 12px 14px;
            padding-bottom: calc(12px + env(safe-area-inset-bottom)); /* 👈 Android/iOS */
          }

          .drawerTotal{
            display:flex;
            justify-content:space-between;
            align-items:baseline;
            gap: 10px;
            font-size: 16px;
            font-weight: 900;
          }
          .drawerTotal b{
            font-size: 18px;
            font-weight: 950;
          }

          .drawerActions{
            margin-top: 10px;
            display:flex;
            gap: 10px;
          }
          .drawerActions .btnGhost,
          .drawerActions .btnPrimary{
            flex: 1;
            min-height: 44px; /* mejor tap target mobile */
          }

          /* ✅ en desktop que no ocupe 100dvh si no hace falta */
          @media (min-width: 900px){
            .drawerBackdrop{ align-items:center; }
            .drawer{
              height: min(720px, 92dvh);
              max-height: min(720px, 92dvh);
              border-radius: 18px;
            }
            .drawerList{
              padding-bottom: calc(120px + env(safe-area-inset-bottom));
            }
          }
        `}</style>

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
