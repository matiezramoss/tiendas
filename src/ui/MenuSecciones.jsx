
// PATH: src/ui/MenuSecciones.jsx
import React, { useMemo } from "react";
import { money } from "../lib/money.js";

function precioMin(producto) {
  const vars = Array.isArray(producto?.variantes) ? producto.variantes : [];
  if (!vars.length) return 0;
  return Math.min(...vars.map((v) => Number(v?.precio || 0)));
}

export default function MenuSecciones({ productos = [], onSelect }) {
  const porCategoria = useMemo(() => {
    const map = new Map();

    for (const p of productos) {
      const cat = (p?.categoria || "Otros").trim();
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(p);
    }

    // orden alfabético dentro de cada categoría
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) =>
        String(a?.nombre || "").localeCompare(String(b?.nombre || ""))
      );
      map.set(k, arr);
    }

    return Array.from(map.entries());
  }, [productos]);

  return (
    <div className="flyerGrid">
      {porCategoria.map(([cat, items]) => (
        <section className="flyerSection" key={cat}>
          <div className="flyerLeft">
            <div className="flyerHead">
              <div className="flyerCat">{cat.toUpperCase()}</div>
              <div className="flyerPrecioHead">PRECIO</div>
            </div>

            <div className="flyerList">
              {items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="flyerRowBtn"
                  onClick={() => onSelect?.(p)}
                >
                  <div className="flyerRow">
                    <div className="flyerItem">
                      <div className="flyerNombre">
                        {p?.nombre || "Producto"}
                      </div>
                      {p?.descripcion ? (
                        <div className="flyerDesc">{p.descripcion}</div>
                      ) : null}
                    </div>

                    <div className="flyerPrice">
                      $ {money(precioMin(p))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
