// PATH: src/ui/ProductoSheet.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { money } from "../lib/money.js";

function precioMin(producto) {
  const vars = Array.isArray(producto?.variantes) ? producto.variantes : [];
  if (!vars.length) return 0;
  return Math.min(...vars.map((v) => Number(v?.precio || 0)));
}
function normalizeKey(x) {
  return String(x || "").trim();
}

// ✅ mismo lock que el drawer (pero con dataset propio para no pisarse)
function lockBodyScrollSheet() {
  const y = window.scrollY || window.pageYOffset || 0;
  document.body.dataset.sheetScrollY = String(y);

  document.body.style.position = "fixed";
  document.body.style.top = `-${y}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}
function unlockBodyScrollSheet() {
  const y = Number(document.body.dataset.sheetScrollY || "0");

  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";

  delete document.body.dataset.sheetScrollY;

  window.scrollTo(0, y);
}

export default function ProductoSheet({ open, onClose, producto, onAdd }) {
  const sheetRef = useRef(null);

  const vars = Array.isArray(producto?.variantes) ? producto.variantes : [];
  const opciones = Array.isArray(producto?.opciones) ? producto.opciones : [];

  const [qty, setQty] = useState(1);
  const [units, setUnits] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!open) return;

    // ✅ lock scroll sin salto
    lockBodyScrollSheet();

    const defaultVar = normalizeKey(vars[0]?.key);
    setQty(1);
    setActiveIdx(0);
    setUnits([{ varKey: defaultVar, sel: {} }]);

    requestAnimationFrame(() => {
      if (sheetRef.current) sheetRef.current.scrollTop = 0;
    });

    return () => {
      unlockBodyScrollSheet();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, producto?.id]);

  useEffect(() => {
    if (!open) return;

    setUnits((prev) => {
      const want = Math.max(1, Number(qty || 1));
      const next = Array.isArray(prev) ? [...prev] : [];
      const defaultVar = normalizeKey(vars[0]?.key);

      if (next.length < want) {
        const base = next[next.length - 1] || { varKey: defaultVar, sel: {} };
        while (next.length < want) {
          next.push({
            varKey: normalizeKey(base.varKey || defaultVar),
            sel: JSON.parse(JSON.stringify(base.sel || {})),
          });
        }
      } else if (next.length > want) {
        next.length = want;
      }
      return next;
    });

    setActiveIdx((i) => Math.min(i, Math.max(1, Number(qty || 1)) - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qty]);

  function isMultiGroup(g) {
    const k = normalizeKey(g?.key);
    return g?.multiple === true || k === "extras";
  }

  const activeUnit = units[activeIdx] || { varKey: normalizeKey(vars[0]?.key), sel: {} };

  const activeVariante = useMemo(() => {
    const k = normalizeKey(activeUnit?.varKey);
    return vars.find((v) => normalizeKey(v?.key) === k) || vars[0] || null;
  }, [vars, activeUnit?.varKey]);

  function precioBaseForVarKey(vk) {
    const k = normalizeKey(vk);
    const v = vars.find((x) => normalizeKey(x?.key) === k) || null;
    return Number(v?.precio ?? precioMin(producto) ?? 0);
  }

  function opcionesElegidasFromUnit(unit) {
    const out = [];
    const sel = unit?.sel || {};

    for (const g of opciones) {
      const gKey = normalizeKey(g?.key);
      const items = Array.isArray(g?.items) ? g.items : [];
      if (!gKey || !items.length) continue;

      if (isMultiGroup(g)) {
        const keys = Array.isArray(sel[gKey]) ? sel[gKey] : [];
        for (const itemKey of keys) {
          const it = items.find((x) => normalizeKey(x?.key) === normalizeKey(itemKey));
          if (!it) continue;
          out.push({
            groupKey: gKey,
            groupTitulo: g?.titulo || "",
            itemKey: normalizeKey(it?.key),
            itemTitulo: it?.titulo || "",
            precioExtra: Number(it?.precioExtra || 0),
          });
        }
      } else {
        const itemKey = sel[gKey];
        if (!itemKey) continue;
        const it = items.find((x) => normalizeKey(x?.key) === normalizeKey(itemKey));
        if (!it) continue;
        out.push({
          groupKey: gKey,
          groupTitulo: g?.titulo || "",
          itemKey: normalizeKey(it?.key),
          itemTitulo: it?.titulo || "",
          precioExtra: Number(it?.precioExtra || 0),
        });
      }
    }
    return out;
  }

  const total = useMemo(() => {
    const arr = Array.isArray(units) && units.length ? units : [activeUnit];
    return arr.reduce((acc, u) => {
      const base = precioBaseForVarKey(u?.varKey);
      const opts = opcionesElegidasFromUnit(u);
      const extra = opts.reduce((a, x) => a + Number(x?.precioExtra || 0), 0);
      return acc + base + extra;
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, opciones, vars, producto?.id]);

  if (!open || !producto) return null;

  function setVarForActive(nextVarKey) {
    setUnits((prev) => {
      const copy = [...prev];
      if (!copy[activeIdx]) return prev;
      copy[activeIdx] = { ...copy[activeIdx], varKey: normalizeKey(nextVarKey) };
      return copy;
    });
  }

  function toggleOption(groupKey, itemKey, groupIsMulti) {
    const gKey = normalizeKey(groupKey);
    const iKey = normalizeKey(itemKey);

    setUnits((prev) => {
      const copy = [...prev];
      const u = copy[activeIdx];
      if (!u) return prev;

      const sel = { ...(u.sel || {}) };

      if (groupIsMulti) {
        const arr = Array.isArray(sel[gKey]) ? [...sel[gKey]] : [];
        const idx = arr.findIndex((k) => normalizeKey(k) === iKey);
        if (idx >= 0) arr.splice(idx, 1);
        else arr.push(iKey);
        if (!arr.length) delete sel[gKey];
        else sel[gKey] = arr;
      } else {
        if (normalizeKey(sel[gKey]) === iKey) delete sel[gKey];
        else sel[gKey] = iKey;
      }

      copy[activeIdx] = { ...u, sel };
      return copy;
    });
  }

  function copyActiveToAll() {
    setUnits((prev) => {
      const copy = [...prev];
      const base = copy[activeIdx];
      if (!base) return prev;
      for (let i = 0; i < copy.length; i++) {
        if (i === activeIdx) continue;
        copy[i] = {
          varKey: normalizeKey(base.varKey),
          sel: JSON.parse(JSON.stringify(base.sel || {})),
        };
      }
      return copy;
    });
  }

  function add() {
    const list = Array.isArray(units) && units.length ? units : [activeUnit];

    for (const u of list) {
      const varianteKey = normalizeKey(u?.varKey) || normalizeKey(vars[0]?.key);
      const varianteObj = vars.find((v) => normalizeKey(v?.key) === varianteKey) || vars[0] || null;

      const base = precioBaseForVarKey(varianteKey);
      const opts = opcionesElegidasFromUnit(u);
      const extra = opts.reduce((a, x) => a + Number(x?.precioExtra || 0), 0);
      const unitPrice = base + extra;

      const item = {
        productoId: producto.id,
        nombreSnapshot: producto?.nombre || "Producto",
        varianteKey,
        varianteTituloSnapshot: varianteObj?.titulo || "",
        opcionesSnapshot: opts.map((x) => ({
          groupKey: x.groupKey,
          groupTitulo: x.groupTitulo,
          itemKey: x.itemKey,
          itemTitulo: x.itemTitulo,
          precioExtra: x.precioExtra,
        })),
        precioUnitSnapshot: unitPrice,
        cantidad: 1,
      };

      onAdd?.(item);
    }

    onClose?.();
  }

  const ui = (
    <div className="productoOverlay" onClick={onClose} role="presentation">
      <div
        className="productoSheet"
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* ✅ BODY SCROLLEABLE */}
        <div className="sheetBody">
          <div className="sheetTop">
            <div>
              <div className="sheetTitle">{producto?.nombre || "Producto"}</div>
              {producto?.descripcion ? <div className="sheetDetalle">{producto.descripcion}</div> : null}
            </div>

            <button className="sheetClose" type="button" onClick={onClose}>
              ✕
            </button>
          </div>

          {activeVariante?.fotoUrl || producto?.fotoUrlBase ? (
            <img className="sheetFoto" src={(activeVariante?.fotoUrl || producto?.fotoUrlBase || "").trim()} alt="" />
          ) : null}

          {Number(qty || 1) > 1 ? (
            <div className="sheetBlock">
              <div className="sheetBlockTitle">Personalizá cada unidad</div>
              <div className="chipRow">
                {units.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={"chip" + (idx === activeIdx ? " on" : "")}
                    onClick={() => setActiveIdx(idx)}
                  >
                    Unidad {idx + 1}
                  </button>
                ))}
                <button type="button" className="chip" onClick={copyActiveToAll}>
                  Copiar a todas
                </button>
              </div>
            </div>
          ) : null}

          {vars.length ? (
            <div className="sheetBlock">
              <div className="sheetBlockTitle">Elegí variante (unidad {activeIdx + 1})</div>
              <div className="chipRow">
                {vars.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    className={"chip" + (normalizeKey(activeUnit?.varKey) === normalizeKey(v.key) ? " on" : "")}
                    onClick={() => setVarForActive(normalizeKey(v.key))}
                  >
                    {v?.titulo || v?.key} · $ {money(Number(v?.precio || 0))}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {opciones.length ? (
            <div className="sheetBlock">
              <div className="sheetBlockTitle">Opciones (unidad {activeIdx + 1})</div>

              {opciones.map((g) => {
                const gKey = normalizeKey(g?.key);
                const items = Array.isArray(g?.items) ? g.items : [];
                const multi = isMultiGroup(g);

                const picked = multi
                  ? (Array.isArray(activeUnit?.sel?.[gKey]) ? activeUnit.sel[gKey] : [])
                  : normalizeKey(activeUnit?.sel?.[gKey]);

                return (
                  <div className="optGroup" key={gKey}>
                    <div className="optTitle">{g?.titulo || "Elegí"}</div>

                    <div className="chipRow">
                      {items.map((it) => {
                        const itKey = normalizeKey(it?.key);
                        const on = multi
                          ? Array.isArray(picked) && picked.some((k) => normalizeKey(k) === itKey)
                          : normalizeKey(picked) === itKey;

                        return (
                          <button
                            key={itKey}
                            type="button"
                            className={"chip" + (on ? " on" : "")}
                            onClick={() => toggleOption(gKey, itKey, multi)}
                          >
                            {it?.titulo || itKey}
                            {Number(it?.precioExtra || 0) ? ` (+$${money(Number(it?.precioExtra || 0))})` : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* ✅ BOTTOM FIJO (NO CORTA EL SCROLL) */}
        <div className="sheetBottom">
          <div className="qty">
            <button className="qtyBtn" type="button" onClick={() => setQty((q) => Math.max(1, (q || 1) - 1))}>
              −
            </button>
            <div className="qtyNum">{qty}</div>
            <button className="qtyBtn" type="button" onClick={() => setQty((q) => (q || 1) + 1)}>
              +
            </button>
          </div>

          <button className="addBtn" type="button" onClick={add}>
            Agregar · $ {money(total)}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(ui, document.body);
}
