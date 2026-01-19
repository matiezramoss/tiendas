// PATH: src/pages/TiendaPublica.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { getTiendaBySlug, listProductos } from "../lib/db.js";
import { applyTheme } from "../lib/theme.js";
import { isProductoDisponibleAhora } from "../lib/time.js";


import TiendaLayout from "../ui/TiendaLayout.jsx";
import MenuSecciones from "../ui/MenuSecciones.jsx";
import ProductoSheet from "../ui/ProductoSheet.jsx";
import CarritoDrawer from "../ui/CarritoDrawer.jsx";

export default function TiendaPublica() {
  const { slug } = useParams();

  const [tienda, setTienda] = useState(null);
  const [productos, setProductos] = useState([]);
  const [error, setError] = useState(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [productoSel, setProductoSel] = useState(null);

  const [carritoOpen, setCarritoOpen] = useState(false);
  const [carrito, setCarrito] = useState([]); // items normalizados

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

  const productosPorId = useMemo(() => {
    const m = new Map();
    for (const p of productos) m.set(p.id, p);
    return m;
  }, [productos]);

function abrirProducto(p) {
  if (!isProductoDisponibleAhora(p, tienda)) {
    alert("Este producto no está disponible en este horario.");
    return;
  }
  setProductoSel(p);
  setSheetOpen(true);
}


  function agregarAlCarrito(item) {
    if (!isProductoDisponibleAhora(productoSel, tienda)) {
  alert("Este producto no está disponible en este horario.");
  return;
}
    // item: { productoId, nombreSnapshot, varianteKey, varianteTituloSnapshot, precioUnitSnapshot, cantidad, opcionesSnapshot }
    setCarrito((prev) => {
      const key = [
        item.productoId,
        item.varianteKey,
        JSON.stringify(item.opcionesSnapshot || []),
      ].join("|");

      const i = prev.findIndex((x) => x._key === key);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = { ...copy[i], cantidad: (copy[i].cantidad || 1) + (item.cantidad || 1) };
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

  if (error) {
    return (
      <div style={{ padding: 20, color: "white" }}>
        <b>Error:</b> {error}
      </div>
    );
  }

  if (!tienda) return <div className="loading">Cargando...</div>;

  return (
    <TiendaLayout tienda={tienda}>
      <MenuSecciones productos={productos} onSelect={abrirProducto} />

      <ProductoSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        producto={productoSel}
        onAdd={agregarAlCarrito}
      />

      <CarritoDrawer
        open={carritoOpen}
        onClose={() => setCarritoOpen(false)}
        tienda={tienda}
        carrito={carrito}
        productosPorId={productosPorId}
        onRemove={quitarDelCarrito}
        onClear={vaciarCarrito}
      />
    </TiendaLayout>
  );
}
