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

export function buildItemsText(pedido) {
  const items = Array.isArray(pedido?.items) ? pedido.items : [];
  if (!items.length) return "—";

  return items
    .map((it) => {
      const qty = Number(it?.cantidad || 1);
      const name = String(it?.nombreSnapshot || "Item").trim();
      const varTxt = it?.varianteTituloSnapshot ? ` (${it.varianteTituloSnapshot})` : "";
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
  const itemsTxt = buildItemsText(pedido);
  const nota = pedido?.mensaje ? `📝 Nota: ${pedido.mensaje}` : "";

  let header = "";
  let extra = "";

  if (tipo === "confirmacion") {
    header = "✅ Confirmación de pedido";
    extra = "📌 Si necesitás cambiar algo, respondé este mensaje.";
  } else if (tipo === "en5") {
    header = "🟡 Pedido en preparación";
    extra = "⏱ Estimado: en 5 minutos está listo.";
  } else if (tipo === "listo") {
    header = "✅ Pedido listo para retirar";
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
