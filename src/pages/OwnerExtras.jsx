// PATH: src/pages/OwnerExtras.jsx
import React, { useEffect, useMemo, useState } from "react";

export default function OwnerExtras({ pedido }) {
  // ✅ nowMs en state para evitar Date.now() durante render
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const createdSec = Number(pedido?.createdAt?.seconds || 0);

  // minutos desde que entró
  const esperaMin = useMemo(() => {
    if (!createdSec) return 0;
    const diff = Math.max(0, nowMs - createdSec * 1000);
    return Math.floor(diff / 60000);
  }, [createdSec, nowMs]);

  // ✅ si querés que “esperando” aparezca a los 10 min (podés cambiar 10 por 5, 8, etc)
  const UMBRAL_ESPERANDO_MIN = 10;

  const estado = String(pedido?.estado || "");
  const isPendiente = estado === "pendiente";
  const isEsperando = isPendiente && esperaMin >= UMBRAL_ESPERANDO_MIN;

  // texto humano “hace X”
  const haceTxt = useMemo(() => {
    if (!createdSec) return "—";
    if (esperaMin < 1) return "recién";
    if (esperaMin < 60) return `hace ${esperaMin} min`;

    const h = Math.floor(esperaMin / 60);
    const m = esperaMin % 60;
    return m ? `hace ${h}h ${m}m` : `hace ${h}h`;
  }, [createdSec, esperaMin]);

  return (
    <div className="ownerExtras">
      {/* ⏰ Badge solo cuando corresponde */}
      {isEsperando ? (
        <span className="badgeWarn" title="Pedido pendiente hace bastante">
          ⏰ esperando · {haceTxt}
        </span>
      ) : (
        // 👇 si NO está esperando, igual mostramos hace cuánto entró (más sutil)
        <span className="badgeTime" title="Cuándo entró el pedido">
          🕒 {haceTxt}
        </span>
      )}
    </div>
  );
}
