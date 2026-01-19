
// // PATH: src/ui/ProductoSheet.jsx
// import React, { useMemo, useState } from "react";
// import { money } from "../lib/money.js";

// function firstVarKey(producto) {
//   return producto?.variantes?.[0]?.key || "";
// }

// function pickDetalle(producto, varSel) {
//   // 1) PRIORIDAD: detalles de la variante
//   const dVar = String(varSel?.detalles || "").trim();
//   if (dVar) return dVar;

//   // (por si algún día lo guardás como singular en variante)
//   const dVar2 = String(varSel?.detalle || "").trim();
//   if (dVar2) return dVar2;

//   // 2) fallback: detalle del producto
//   const dProd = String(producto?.detalle || "").trim();
//   if (dProd) return dProd;

//   return "";
// }

// export default function ProductoSheet({ open, onClose, producto, onAdd }) {
//   const [varKey, setVarKey] = useState("");
//   const [opts, setOpts] = useState({}); // { grupoKey: itemKey | [itemKeys] }
//   const [cantidad, setCantidad] = useState(1);

//   const vars = Array.isArray(producto?.variantes) ? producto.variantes : [];
//   const opciones = Array.isArray(producto?.opciones) ? producto.opciones : [];

//   const currentVarKey = varKey || firstVarKey(producto);

//   const varSel = useMemo(() => {
//     return vars.find((v) => v.key === currentVarKey) || vars[0] || null;
//   }, [vars, currentVarKey]);

//   const foto = useMemo(() => {
//     return (varSel?.fotoUrl || producto?.fotoUrlBase || "").trim();
//   }, [varSel, producto]);

//   const detalleMostrado = useMemo(() => {
//     return pickDetalle(producto, varSel);
//   }, [producto, varSel]);

//   const extras = useMemo(() => {
//     let sum = 0;
//     const snapshot = [];

//     for (const g of opciones) {
//       const gk = g.key;
//       const val = opts[gk];

//       if (!val) continue;

//       const items = Array.isArray(g.items) ? g.items : [];

//       // soporta single o multi
//       const picked = Array.isArray(val) ? val : [val];
//       for (const k of picked) {
//         const it = items.find((x) => x.key === k);
//         if (!it) continue;
//         const extra = Number(it.precioExtra || 0);
//         sum += extra;
//         snapshot.push({
//           grupoKey: gk,
//           grupoTitulo: g.titulo,
//           itemKey: it.key,
//           itemTitulo: it.titulo,
//           precioExtra: extra,
//         });
//       }
//     }

//     return { sum, snapshot };
//   }, [opciones, opts]);

//   const totalUnit = Number(varSel?.precio || 0) + extras.sum;
//   const total = totalUnit * Number(cantidad || 1);

//   // reset cuando cambia producto
//   React.useEffect(() => {
//     setVarKey("");
//     setOpts({});
//     setCantidad(1);
//   }, [producto?.id]);

//   if (!open || !producto) return null;

//   function toggleGrupoItem(grupo, item) {
//     // por ahora: single choice por grupo (podemos hacer multi después si querés)
//     setOpts((prev) => ({ ...prev, [grupo.key]: item.key }));
//   }

//   return (
//     <div className="productoOverlay" onClick={onClose}>
//       <div className="productoSheet" onClick={(e) => e.stopPropagation()}>
//         <div className="sheetTop">
//           <div className="sheetTitle">{producto.nombre}</div>
//           <button className="sheetClose" onClick={onClose} type="button">
//             ✕
//           </button>
//         </div>

//         {foto ? <img className="sheetFoto" src={foto} alt="" /> : null}

//         {detalleMostrado ? (
//           <div className="sheetDetalle">{detalleMostrado}</div>
//         ) : null}

//         {/* Variantes */}
//         {vars.length > 0 ? (
//           <div className="sheetBlock">
//             <div className="sheetBlockTitle">Elegí variante</div>
//             <div className="chipRow">
//               {vars.map((v) => (
//                 <button
//                   key={v.key}
//                   type="button"
//                   className={`chip ${currentVarKey === v.key ? "on" : ""}`}
//                   onClick={() => setVarKey(v.key)}
//                 >
//                   {v.titulo} · $ {money(v.precio)}
//                 </button>
//               ))}
//             </div>
//           </div>
//         ) : null}

//         {/* Opciones */}
//         {opciones.length > 0 ? (
//           <div className="sheetBlock">
//             <div className="sheetBlockTitle">Opciones</div>
//             {opciones.map((g) => (
//               <div className="optGroup" key={g.key}>
//                 <div className="optTitle">{g.titulo}</div>
//                 <div className="chipRow">
//                   {(g.items || []).map((it) => (
//                     <button
//                       key={it.key}
//                       type="button"
//                       className={`chip ${opts[g.key] === it.key ? "on" : ""}`}
//                       onClick={() => toggleGrupoItem(g, it)}
//                     >
//                       {it.titulo}
//                       {Number(it.precioExtra || 0)
//                         ? ` · +$ ${money(it.precioExtra)}`
//                         : ""}
//                     </button>
//                   ))}
//                 </div>
//               </div>
//             ))}
//           </div>
//         ) : null}

//         {/* Cantidad + agregar */}
//         <div className="sheetBottom">
//           <div className="qty">
//             <button
//               type="button"
//               className="qtyBtn"
//               onClick={() => setCantidad((c) => Math.max(1, c - 1))}
//             >
//               −
//             </button>
//             <div className="qtyNum">{cantidad}</div>
//             <button
//               type="button"
//               className="qtyBtn"
//               onClick={() => setCantidad((c) => c + 1)}
//             >
//               +
//             </button>
//           </div>

//           <button
//             type="button"
//             className="addBtn"
//             onClick={() => {
//               onAdd?.({
//                 productoId: producto.id,
//                 nombreSnapshot: producto.nombre,
//                 varianteKey: varSel?.key || "",
//                 varianteTituloSnapshot: varSel?.titulo || "",
//                 precioUnitSnapshot: totalUnit,
//                 cantidad,
//                 opcionesSnapshot: extras.snapshot,
//               });
//               onClose?.();
//             }}
//           >
//             Agregar · $ {money(total)}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }
// PATH: src/ui/ProductoSheet.jsx
import React, { useMemo, useState } from "react";
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

export default function ProductoSheet({ open, onClose, producto, onAdd }) {
  const [varKey, setVarKey] = useState("");
  const [opts, setOpts] = useState({}); // { grupoKey: itemKey | [itemKeys] }
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

  const detalleMostrado = useMemo(() => {
    return pickDetalle(producto, varSel);
  }, [producto, varSel]);

  const extras = useMemo(() => {
    let sum = 0;
    const snapshot = [];

    for (const g of opciones) {
      const gk = g.key;
      const val = opts[gk];
      if (!val) continue;

      const items = Array.isArray(g.items) ? g.items : [];

      // soporta single o multi
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

  // reset cuando cambia producto
  React.useEffect(() => {
    setVarKey("");
    setOpts({});
    setCantidad(1);
  }, [producto?.id]);

  if (!open || !producto) return null;

  function toggleGrupoItem(grupo, item) {
    setOpts((prev) => ({ ...prev, [grupo.key]: item.key }));
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
            {opciones.map((g) => (
              <div className="optGroup" key={g.key}>
                <div className="optTitle">{g.titulo}</div>
                <div className="chipRow">
                  {(g.items || []).map((it) => (
                    <button
                      key={it.key}
                      type="button"
                      className={`chip ${opts[g.key] === it.key ? "on" : ""}`}
                      onClick={() => toggleGrupoItem(g, it)}
                    >
                      {it.titulo}
                      {Number(it.precioExtra || 0)
                        ? ` · +$ ${money(it.precioExtra)}`
                        : ""}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Cantidad + agregar */}
        <div className="sheetBottom">
          <div className="qty">
            <button
              type="button"
              className="qtyBtn"
              onClick={() => setCantidad((c) => Math.max(1, c - 1))}
            >
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
                precioUnitSnapshot: totalUnit,
                cantidad,
                opcionesSnapshot: extras.snapshot,

                // ✅ CLAVE para validar horarios en checkout:
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
