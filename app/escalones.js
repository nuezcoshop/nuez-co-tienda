// Escalones de la tienda: beneficios según el monto de la compra (descuento % / descuento $ / envío gratis).

export function limpiarEscalones(lista, envioGratisDesde) {
  let e = (Array.isArray(lista) ? lista : [])
    .map((x) => ({
      desde: Number(x?.desde) || 0,
      tipo: ["porcentaje", "monto", "envio_gratis"].includes(x?.tipo) ? x.tipo : "porcentaje",
      valor: Number(x?.valor) || 0,
      mensaje: String(x?.mensaje || "").trim(),
    }))
    .filter((x) => x.desde > 0 && (x.tipo === "envio_gratis" || x.valor > 0))
    .sort((a, b) => a.desde - b.desde)
    .slice(0, 3);
  // Compatibilidad: si todavía no se configuraron escalones, se usa el "envío gratis desde" de siempre.
  if (e.length === 0 && Number(envioGratisDesde) > 0) {
    e = [{ desde: Number(envioGratisDesde), tipo: "envio_gratis", valor: 0, mensaje: "" }];
  }
  return e;
}

export function textoBeneficio(e, money) {
  if (e.tipo === "envio_gratis") return "envío gratis";
  if (e.tipo === "monto") return `${money(e.valor)} de descuento`;
  return `${String(e.valor).replace(".", ",")}% de descuento`;
}

// Reglas: el descuento (% o $) rige desde su monto, tanto para retiro como para envío.
// El envío gratis rige solo con entrega a domicilio y, en ese caso, reemplaza al descuento.
export function estadoEscalones(escalones, total, entrega) {
  let descTier = null;
  let envioTier = null;
  let siguiente = null;
  for (const e of escalones) {
    if (total >= e.desde) {
      if (e.tipo === "envio_gratis") envioTier = e;
      else descTier = e;
    } else if (!siguiente && (entrega === "envio" || e.tipo !== "envio_gratis")) siguiente = e;
  }
  let descBruto = 0;
  if (descTier && descTier.tipo === "porcentaje") descBruto = Math.round((total * Math.min(descTier.valor, 100)) / 100);
  if (descTier && descTier.tipo === "monto") descBruto = Math.min(descTier.valor, total);
  const envioGratis = entrega === "envio" && !!envioTier;
  return {
    descTier,
    envioTier,
    siguiente,
    envioGratis,
    descuento: envioGratis ? 0 : descBruto,
    descuentoSiRetira: descBruto,
  };
}
