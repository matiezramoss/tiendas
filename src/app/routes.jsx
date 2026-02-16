// PATH: src/app/routes.jsx
import { Routes as RR, Route, Navigate, useLocation } from "react-router-dom";

import Home from "../pages/Home";
import TiendaPublica from "../pages/TiendaPublica";
import Checkout from "../pages/Checkout";
import TrackingPedido from "../pages/TrackingPedido";
import OwnerPanel from "../pages/OwnerPanel";
import AdminLogin from "../pages/AdminLogin";

import { useAdminSession } from "../lib/adminSession.js";

// ✅ compat: si alguien entra con el esquema viejo /t/:slug
function RedirectOldT() {
  const loc = useLocation();
  const parts = String(loc.pathname || "").split("/");
  const slug = parts[2] || "";
  const rest = parts.slice(3).join("/");
  const to = rest ? `/${slug}/${rest}` : `/${slug}`;
  return <Navigate to={to} replace />;
}

// ✅ alias legacy por si alguien quedó con /checkout o /pedido/:id
function RedirectCheckoutToDefaultSlug() {
  return <Navigate to="/chaketortas/checkout" replace />;
}

function RedirectPedidoToDefaultSlug() {
  const loc = useLocation();
  const parts = String(loc.pathname || "").split("/");
  const id = parts[2] || "";
  return <Navigate to={`/chaketortas/pedido/${id}`} replace />;
}

function RequireAdmin({ children }) {
  const { loading, userDoc } = useAdminSession();

  if (loading) return <div className="loading">Cargando…</div>;
  if (!userDoc) return <Navigate to="/admin/login" replace />;

  return children;
}

export function Routes() {
  return (
    <RR>
      {/* Home: lista de tiendas + login */}
      <Route path="/" element={<Home />} />

      {/* ✅ alias para que /checkout NO rompa (legacy) */}
      <Route path="/checkout" element={<RedirectCheckoutToDefaultSlug />} />

      {/* ✅ alias para tracking si alguien entra /pedido/:id (legacy) */}
      <Route path="/pedido/:id" element={<RedirectPedidoToDefaultSlug />} />

      {/* compat rutas viejas */}
      <Route path="/t/:slug/*" element={<RedirectOldT />} />

      {/* rutas canon (limpias): /:slug */}
      <Route path="/:slug" element={<TiendaPublica />} />
      <Route path="/:slug/checkout" element={<Checkout />} />
      <Route path="/:slug/pedido/:id" element={<TrackingPedido />} />

      {/* ✅ admin */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <OwnerPanel />
          </RequireAdmin>
        }
      />

      {/* compat */}
      <Route path="/owner" element={<Navigate to="/admin" replace />} />

      {/* fallback */}
      <Route path="*" element={<div className="loading">Ruta no encontrada</div>} />
    </RR>
  );
}
