// PATH: src/lib/whatsapp.js

function onlyDigits(s) {
  return String(s || "").replace(/\D/g, "");
}

// Heurística AR: si no trae país, le antepone 54.
// Si querés que NO agregue 54 nunca, decime y te lo ajusto.
export function normalizePhoneForWhatsApp(raw) {
  let d = onlyDigits(raw);
  if (!d) return "";

  if (d.startsWith("54")) return d;

  // si empieza con 0 (ej 0341...) lo sacamos
  if (d.startsWith("0")) d = d.slice(1);

  // parece número sin país => anteponemos 54
  if (d.length >= 8 && d.length <= 13) return `54${d}`;

  return d;
}

function groupOpcionesText(opciones, money) {
  const ops = Array.isArray(opciones) ? opciones : [];
  if (!ops.length) return "";

  // Agrupar por groupTitulo (fallback groupKey / "Opciones")
  const byGroup = new Map();
  for (const o of ops) {
    const g = String(o?.groupTitulo || o?.groupKey || "Opciones").trim() || "Opciones";
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(o);
  }

  const groups = Array.from(byGroup.entries());

  // Formato:
  //    ▸ Extras: Queso (+$200) · Bacon
  //    ▸ Salsas: BBQ · Mayo
  return groups
    .map(([gTitle, arr]) => {
      const line = (arr || [])
        .map((o) => {
          const t = String(o?.itemTitulo || o?.itemKey || "—").trim() || "—";
          const ex = Number(o?.precioExtra || 0);
          return ex > 0 ? `${t} (+$${money(ex)})` : t;
        })
        .join(" · ");

      return `   ▸ ${gTitle}: ${line}`;
    })
    .join("\n");
}

export function buildItemsText(pedido) {
  const items = Array.isArray(pedido?.items) ? pedido.items : [];
  if (!items.length) return "—";

  // Acá asumimos que `money` llega por buildWhatsAppMessage y se usa ahí.
  // Pero buildItemsText hoy no recibe money.
  // Solución: buildItemsText se usa desde buildWhatsAppMessage (que sí tiene money),
  // así que dejamos buildItemsText simple y creamos buildItemsTextFull abajo.
  return items
    .map((it) => {
      const qty = Number(it?.cantidad || 1);
      const name = String(it?.nombreSnapshot || "Item").trim();
      const varTxt = it?.varianteTituloSnapshot ? ` (${it.varianteTituloSnapshot})` : "";
      return `• x${qty} ${name}${varTxt}`;
    })
    .join("\n");
}

function buildItemsTextFull(pedido, money) {
  const items = Array.isArray(pedido?.items) ? pedido.items : [];
  if (!items.length) return "—";

  return items
    .map((it) => {
      const qty = Number(it?.cantidad || 1);
      const name = String(it?.nombreSnapshot || "Item").trim() || "Item";
      const varTxt = it?.varianteTituloSnapshot ? ` (${it.varianteTituloSnapshot})` : "";

      const optsTxt = groupOpcionesText(it?.opcionesSnapshot, money);

      // Si hay opciones, las agregamos abajo del ítem
      // • x1 Hamburguesa (Doble)
      //    ▸ Extras: Queso (+$200) · Bacon
      if (optsTxt) return `• x${qty} ${name}${varTxt}\n${optsTxt}`;

      return `• x${qty} ${name}${varTxt}`;
    })
    .join("\n");
}

/**
 * tipo:
 * - "confirmacion"
 * - "en5"
 * - "listo"
 */
export function buildWhatsAppMessage({
  tipo,
  pedido,
  tiendaId,
  money,
  calcTotalPedido,
  pagoInfo,
}) {
  const nombre =
    `${pedido?.cliente?.nombre || ""} ${pedido?.cliente?.apellido || ""}`.trim() || "Cliente";

  const total = calcTotalPedido(pedido);
  const pago = pagoInfo(pedido, total);

  // ✅ ahora el texto incluye agregados/opciones
  const itemsTxt = buildItemsTextFull(pedido, money);

  const nota = pedido?.mensaje ? `📝 Nota: ${pedido.mensaje}` : "";

  let header = "";
  let extra = "";

  if (tipo === "confirmacion") {
    header = "🔥 Confirmación de pedido";
    extra = "🔥 Si necesitás cambiar algo, respondé este mensaje.";
  } else if (tipo === "en5") {
    header = "🟡 Pedido en preparación";
    extra = "⏱ Estimado: en 5 minutos está listo.";
  } else if (tipo === "listo") {
    header = "🔥 Pedido listo para retirar";
    extra = "📍 Podés pasar a retirarlo cuando quieras.";
  } else {
    header = "📦 Pedido";
  }

  const lines = [
    header,
    `Hola ${nombre}!`,
    "",
    `🏪 Tienda: ${tiendaId || "—"}`,
    "",
    "🧾 Pedido:",
    itemsTxt,
    nota ? `\n${nota}` : "",
    "",
    `💳 Pago: ${pago.badge}`,
    pago.line1,
    pago.line2 && pago.line2 !== "—" ? pago.line2 : "",
    "",
    `💰 Total: $ ${money(total)}`,
    "",
    extra,
    "",
    "Gracias 🙌",
  ].filter(Boolean);

  return lines.join("\n");
}

export function openWhatsAppTo({ pedido, tiendaId, tipo, money, calcTotalPedido, pagoInfo }) {
  const raw = pedido?.cliente?.contacto || "";
  const phone = normalizePhoneForWhatsApp(raw);

  if (!phone) {
    alert("Este pedido no tiene número de WhatsApp válido (cliente.contacto).");
    return;
  }

  const msg = buildWhatsAppMessage({
    tipo,
    pedido,
    tiendaId,
    money,
    calcTotalPedido,
    pagoInfo,
  });

  const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
