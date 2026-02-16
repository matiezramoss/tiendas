// PATH: src/pages/Home.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { listTiendasPublicas } from "../lib/db.js";
import { applyTheme } from "../lib/theme.js";
import { useAdminSession } from "../lib/adminSession.js";

function pickCover(t) {
  return (
    t?.branding?.coverUrl ||
    t?.branding?.cover ||
    t?.branding?.imagenes?.coverUrl ||
    ""
  );
}

function pickLogo(t) {
  return (
    t?.branding?.logoUrl ||
    t?.branding?.logo ||
    t?.branding?.imagenes?.logoUrl ||
    ""
  );
}

export default function Home() {
  const nav = useNavigate();
  const { loading: adminLoading, userDoc, tiendaId } = useAdminSession();

  const [loading, setLoading] = useState(true);
  const [tiendas, setTiendas] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    // tema neutral para home (no usar el de una tienda)
    applyTheme({
      panel: "#0e0e0e",
      text: "#ffffff",
      muted: "#bdbdbd",
      primary: "#ff7a00",
    });

    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const all = await listTiendasPublicas();
        if (!alive) return;
        setTiendas(all);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "No se pudieron cargar las tiendas");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const activas = useMemo(
    () => (tiendas || []).filter((t) => t?.activo !== false),
    [tiendas]
  );

  return (
    <div style={{ padding: 14, maxWidth: 980, margin: "0 auto" }}>
      <div className="miniCard" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 20 }}>Armatupedido</div>
            <div style={{ opacity: 0.75, marginTop: 4, fontSize: 13 }}>
              Elegí una tienda para ver el menú y hacer tu pedido.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {!adminLoading && userDoc && tiendaId ? (
              <button className="btnPrimary" type="button" onClick={() => nav("/admin")}
              >
                Ir a mi panel
              </button>
            ) : (
              <button className="btnPrimary" type="button" onClick={() => nav("/admin/login")}
              >
                Iniciar sesión
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ height: 12 }} />

      {err ? (
        <div className="miniCard" style={{ padding: 14 }}>
          ⛔ {err}
        </div>
      ) : null}

      {loading ? (
        <div className="loading">Cargando tiendas…</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          {activas.map((t) => {
            const cover = pickCover(t);
            const logo = pickLogo(t);
            return (
              <button
                key={t.id}
                type="button"
                className="miniCard"
                style={{
                  padding: 0,
                  textAlign: "left",
                  overflow: "hidden",
                  cursor: "pointer",
                }}
                onClick={() => nav(`/${t.id}`)}
              >
                {cover ? (
                  <div
                    style={{
                      height: 120,
                      backgroundImage: `url(${cover})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      filter: "saturate(1.05)",
                    }}
                  />
                ) : (
                  <div style={{ height: 80, background: "rgba(255,255,255,.06)" }} />
                )}

                <div style={{display: "flex", gap: 10, alignItems: "center"}}>
                  {logo ? (
                    <img
                      src={logo}
                      alt=""
                      style={{ width: 120, height: 120, borderRadius: 12, objectFit: "cover" }}
                      loading="lazy"
                    />
                  ) : (
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: "rgba(255,255,255,.08)",
                      }}
                    />
                  )}

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 20, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "white"  }}>
                      {t?.nombre || t.id}
                    </div>
                   
                  </div>
                </div>
              </button>
            );
          })}

          {!activas.length && !err ? (
            <div className="miniCard" style={{ padding: 14 }}>
              No hay tiendas activas todavía.
            </div>
          ) : null}
        </div>
      )}

      <div style={{ height: 18 }} />

      
    </div>
  );
}
