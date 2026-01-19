// PATH: src/app/routes.jsx
import { Routes as RR, Route, Navigate } from "react-router-dom";

import TiendaPublica from "../pages/TiendaPublica";
import Checkout from "../pages/Checkout";
import TrackingPedido from "../pages/TrackingPedido";
import OwnerPanel from "../pages/OwnerPanel";

export function Routes() {
  return (
    <RR>
      <Route path="/" element={<Navigate to="/t/chaketortas" />} />
      <Route path="/t/:slug" element={<TiendaPublica />} />
      <Route path="/t/:slug/checkout" element={<Checkout />} />
      <Route path="/t/:slug/pedido/:id" element={<TrackingPedido />} />
      <Route path="/owner" element={<OwnerPanel />} />
    </RR>
  );
}
