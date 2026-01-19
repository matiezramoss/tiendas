// PATH: src/app/routes.jsx
import { Routes as RR, Route, Navigate, useLocation } from "react-router-dom";

import TiendaPublica from "../pages/TiendaPublica";
import Checkout from "../pages/Checkout";
import TrackingPedido from "../pages/TrackingPedido";
import OwnerPanel from "../pages/OwnerPanel";

function RedirectCheckoutToDefaultSlug() {
  return <Navigate to="/t/chaketortas/checkout" replace />;
}

function RedirectPedidoToDefaultSlug() {
  const loc = useLocation();
  const parts = String(loc.pathname || "").split("/");
  const id = parts[2] || "";
  return <Navigate to={`/t/chaketortas/pedido/${id}`} replace />;
}

export function Routes() {
  return (
    <RR>
      <Route path="/" element={<Navigate to="/t/chaketortas" replace />} />

      {/* ✅ alias para que /checkout NO rompa */}
      <Route path="/checkout" element={<RedirectCheckoutToDefaultSlug />} />

      {/* ✅ alias para tracking si alguien entra /pedido/:id */}
      <Route path="/pedido/:id" element={<RedirectPedidoToDefaultSlug />} />

      {/* rutas “canon” */}
      <Route path="/t/:slug" element={<TiendaPublica />} />
      <Route path="/t/:slug/checkout" element={<Checkout />} />
      <Route path="/t/:slug/pedido/:id" element={<TrackingPedido />} />
      <Route path="/owner" element={<OwnerPanel />} />

      {/* fallback */}
      <Route path="*" element={<div className="loading">Ruta no encontrada</div>} />
    </RR>
  );
}
