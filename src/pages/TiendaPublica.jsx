// PATH: src/pages/TiendaPublica.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";

import { getTiendaBySlug, listProductos } from "../lib/db.js";
import { applyTheme } from "../lib/theme.js";
import { isProductoDisponibleAhora } from "../lib/time.js";

import TiendaLayout from "../ui/TiendaLayout.jsx";
import MenuSecciones from "../ui/MenuSecciones.jsx";
import ProductoSheet from "../ui/ProductoSheet.jsx";
import CarritoDrawer from "../ui/CarritoDrawer.jsx";
import { money } from "../lib/money.js";

function calcTotal(carrito) {
  return (carrito || []).reduce(
    (acc, it) => acc + Number(it?.precioUnitSnapshot || 0) * Number(it?.cantidad || 1),
    0
  );
}

function storageKeyForCarrito(slug) {
  return `carrito_${String(slug || "").trim() || "tienda"}`;
}

function safeParseJSON(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function loadCarritoFromStorage(slug) {
  try {
    const key = storageKeyForCarrito(slug);
    const raw = localStorage.getItem(key);
    const restored = safeParseJSON(raw, []);
    return Array.isArray(restored) ? restored : [];
  } catch {
    return [];
  }
}

export default function TiendaPublica() {
  const { slug } = useParams();
  const nav = useNavigate();

  const [tienda, setTienda] = useState(null);
  const [productos, setProductos] = useState([]);
  const [error, setError] = useState(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [productoSel, setProductoSel] = useState(null);

  const [carritoOpen, setCarritoOpen] = useState(false);

  // ✅ IMPORTANTE: inicializa desde localStorage (sin useEffect + setState)
  const [carrito, setCarrito] = useState(() => loadCarritoFromStorage(slug));

  // ✅ Cargar tienda + productos
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setError(null);

        const t = await getTiendaBySlug(slug);
        if (!alive) return;

        setTienda(t);
        applyTheme(t?.branding?.colores || {});

        const prods = await listProductos(t.id);
        if (!alive) return;

        setProductos(prods);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setError(e?.message || "Error cargando tienda");
      }
    })();

    return () => {
      alive = false;
    };
  }, [slug]);

  // ✅ Persistir carrito automáticamente
  useEffect(() => {
    const key = storageKeyForCarrito(slug);
    try {
      if (Array.isArray(carrito) && carrito.length) {
        localStorage.setItem(key, JSON.stringify(carrito));
      } else {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn("No se pudo guardar carrito en localStorage", e);
    }
  }, [carrito, slug]);

  const totalCarrito = useMemo(() => calcTotal(carrito), [carrito]);
  const cantItems = useMemo(
    () => (carrito || []).reduce((a, it) => a + Number(it?.cantidad || 1), 0),
    [carrito]
  );

  function abrirProducto(p) {
    if (!isProductoDisponibleAhora(p, tienda)) {
      alert("Este producto no está disponible en este horario.");
      return;
    }
    setProductoSel(p);
    setSheetOpen(true);
    setCarritoOpen(false);
  }

  function agregarAlCarrito(item) {
    if (!isProductoDisponibleAhora(productoSel, tienda)) {
      alert("Este producto no está disponible en este horario.");
      return;
    }

    setCarrito((prev) => {
      const key = [item.productoId, item.varianteKey, JSON.stringify(item.opcionesSnapshot || [])].join("|");

      const i = prev.findIndex((x) => x._key === key);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = {
          ...copy[i],
          cantidad: (copy[i].cantidad || 1) + (item.cantidad || 1),
        };
        return copy;
      }
      return [...prev, { ...item, _key: key }];
    });

    setCarritoOpen(true);
  }

  function quitarDelCarrito(_key) {
    setCarrito((prev) => prev.filter((x) => x._key !== _key));
  }

  function vaciarCarrito() {
    setCarrito([]);
  }

  function irCheckout() {
    nav(`/${slug}/checkout`, { state: { tienda, carrito } });
  }

  if (error) {
    return (
      <div style={{ padding: 20, color: "white" }}>
        <b>Error:</b> {error}
      </div>
    );
  }

  if (!tienda) return <div className="loading">Cargando...</div>;

  // ✅ FAB visible solo cuando NO hay overlays abiertos
  const showFab = !sheetOpen && !carritoOpen;

  return (
    <TiendaLayout tienda={tienda}>
      <MenuSecciones productos={productos} onSelect={abrirProducto} />

      <ProductoSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        producto={productoSel}
        onAdd={agregarAlCarrito}
      />

      {/* ✅ FAB SOLO SI NO HAY SHEET/DRAWER */}
      {showFab
        ? createPortal(
            <button
              type="button"
              className="cartFab"
              onClick={() => setCarritoOpen(true)}
              aria-label="Abrir carrito"
            >
              <span className="cartFabIcon" aria-hidden="true">
                🛒
              </span>

              {cantItems > 0 ? <span className="cartFabBadge">{cantItems}</span> : null}

              {totalCarrito > 0 ? (
                <span className="cartFabTotal">$ {money(totalCarrito)}</span>
              ) : (
                <span className="cartFabTotal" style={{ opacity: 0.75 }} />
              )}
            </button>,
            document.body
          )
        : null}

      <CarritoDrawer
        open={carritoOpen}
        onClose={() => setCarritoOpen(false)}
        tienda={tienda}
        carrito={carrito}
        onRemove={quitarDelCarrito}
        onClear={vaciarCarrito}
        onCheckout={irCheckout}
      />
    </TiendaLayout>
  );
}
