// PATH: src/ui/ProductoSheet.jsx
import React, { useMemo, useState, useEffect } from "react";
import { money } from "../lib/money.js";

function firstVarKey(producto) {
  return producto?.variantes?.[0]?.key || "";
}

function pickDetalle(producto, varSel) {
  // 1) PRIORIDAD: detalles de la variante
  const dVar = String(varSel?.detalles || "").trim();
  if (dVar) return dVar;

  // (compat por si algún día lo guardás singular en variante)
  const dVar2 = String(varSel?.detalle || "").trim();
  if (dVar2) return dVar2;

  // 2) fallback: detalle del producto
  const dProd = String(producto?.detalle || "").trim();
  if (dProd) return dProd;

  return "";
}

function isMultiGroup(g) {
  // ✅ Auto: si el grupo dice "extras" => multi
  const t = String(g?.titulo || "").toLowerCase();
  if (t.includes("extras") || t.includes("extra")) return true;

  // ✅ Si algún día lo agregás en la data:
  if (typeof g?.multi === "boolean") return g.multi;

  return false;
}

function toArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

export default function ProductoSheet({ open, onClose, producto, onAdd }) {
  const [varKey, setVarKey] = useState("");
  // opts: { grupoKey: string | string[] }
  const [opts, setOpts] = useState({});
  const [cantidad, setCantidad] = useState(1);

  const vars = Array.isArray(producto?.variantes) ? producto.variantes : [];
  const opciones = Array.isArray(producto?.opciones) ? producto.opciones : [];

  const currentVarKey = varKey || firstVarKey(producto);

  const varSel = useMemo(() => {
    return vars.find((v) => v.key === currentVarKey) || vars[0] || null;
  }, [vars, currentVarKey]);

  const foto = useMemo(() => {
    return (varSel?.fotoUrl || producto?.fotoUrlBase || "").trim();
  }, [varSel, producto]);

  const detalleMostrado = useMemo(() => pickDetalle(producto, varSel), [producto, varSel]);

  const extras = useMemo(() => {
    let sum = 0;
    const snapshot = [];

    for (const g of opciones) {
      const gk = g.key;
      const val = opts[gk];
      if (!val) continue;

      const items = Array.isArray(g.items) ? g.items : [];

      const picked = Array.isArray(val) ? val : [val];
      for (const k of picked) {
        const it = items.find((x) => x.key === k);
        if (!it) continue;

        const extra = Number(it.precioExtra || 0);
        sum += extra;

        snapshot.push({
          grupoKey: gk,
          grupoTitulo: g.titulo,
          itemKey: it.key,
          itemTitulo: it.titulo,
          precioExtra: extra,
        });
      }
    }

    return { sum, snapshot };
  }, [opciones, opts]);

  const totalUnit = Number(varSel?.precio || 0) + extras.sum;
  const total = totalUnit * Number(cantidad || 1);

  // ✅ Reset cuando cambia producto (sin error de “setState sincrónico en effect”)
  // Lo diferimos a la próxima vuelta del event loop.
  useEffect(() => {
    if (!producto?.id) return;

    const t = setTimeout(() => {
      setVarKey("");
      setOpts({});
      setCantidad(1);
    }, 0);

    return () => clearTimeout(t);
  }, [producto?.id]);

  if (!open || !producto) return null;

  function toggleGrupoItem(grupo, item) {
    const multi = isMultiGroup(grupo);

    setOpts((prev) => {
      const gk = grupo.key;

      if (!multi) {
        // ✅ SINGLE: deja 1 solo seleccionado
        return { ...prev, [gk]: item.key };
      }

      // ✅ MULTI: agrega / saca del array
      const prevArr = toArray(prev[gk]);
      const exists = prevArr.includes(item.key);
      const nextArr = exists ? prevArr.filter((k) => k !== item.key) : [...prevArr, item.key];

      // si queda vacío, borramos la key (limpio)
      if (!nextArr.length) {
        const cp = { ...prev };
        delete cp[gk];
        return cp;
      }

      return { ...prev, [gk]: nextArr };
    });
  }

  function isSelected(grupo, itemKey) {
    const val = opts[grupo.key];
    if (!val) return false;
    if (Array.isArray(val)) return val.includes(itemKey);
    return val === itemKey;
  }

  return (
    <div className="productoOverlay" onClick={onClose}>
      <div className="productoSheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheetTop">
          <div className="sheetTitle">{producto.nombre}</div>
          <button className="sheetClose" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        {foto ? <img className="sheetFoto" src={foto} alt="" /> : null}

        {detalleMostrado ? <div className="sheetDetalle">{detalleMostrado}</div> : null}

        {/* Variantes */}
        {vars.length > 0 ? (
          <div className="sheetBlock">
            <div className="sheetBlockTitle">Elegí variante</div>
            <div className="chipRow">
              {vars.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  className={`chip ${currentVarKey === v.key ? "on" : ""}`}
                  onClick={() => setVarKey(v.key)}
                >
                  {v.titulo} · $ {money(v.precio)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Opciones */}
        {opciones.length > 0 ? (
          <div className="sheetBlock">
            <div className="sheetBlockTitle">Opciones</div>

            {opciones.map((g) => {
              const multi = isMultiGroup(g);
              return (
                <div className="optGroup" key={g.key}>
                  <div className="optTitle">
                    {g.titulo}
                    <span style={{ marginLeft: 8, opacity: 0.65, fontSize: 12, fontWeight: 800 }}>
                      {multi ? "· podés elegir varias" : "· elegí una"}
                    </span>
                  </div>

                  <div className="chipRow">
                    {(g.items || []).map((it) => (
                      <button
                        key={it.key}
                        type="button"
                        className={`chip ${isSelected(g, it.key) ? "on" : ""}`}
                        onClick={() => toggleGrupoItem(g, it)}
                        title={multi ? "Podés seleccionar varias" : "Solo una"}
                      >
                        {it.titulo}
                        {Number(it.precioExtra || 0) ? ` · +$ ${money(it.precioExtra)}` : ""}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Cantidad + agregar */}
        <div className="sheetBottom">
          <div className="qty">
            <button type="button" className="qtyBtn" onClick={() => setCantidad((c) => Math.max(1, c - 1))}>
              −
            </button>
            <div className="qtyNum">{cantidad}</div>
            <button type="button" className="qtyBtn" onClick={() => setCantidad((c) => c + 1)}>
              +
            </button>
          </div>

          <button
            type="button"
            className="addBtn"
            onClick={() => {
              onAdd?.({
                productoId: producto.id,
                nombreSnapshot: producto.nombre,
                varianteKey: varSel?.key || "",
                varianteTituloSnapshot: varSel?.titulo || "",
                precioUnitSnapshot: totalUnit, // ✅ ya incluye extras
                cantidad,
                opcionesSnapshot: extras.snapshot,

                // ✅ horarios para checkout:
                tagsHorarioSnapshot: Array.isArray(producto?.tagsHorario) ? producto.tagsHorario : [],
              });
              onClose?.();
            }}
          >
            Agregar · $ {money(total)}
          </button>
        </div>
      </div>
    </div>
  );
}
