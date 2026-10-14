// Escalones de la tienda: beneficios según el monto de la compra (descuento % / descuento $ / envío gratis).
// Rige SIEMPRE el escalón más alto alcanzado (reemplaza al anterior, no se suman).

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

export function estadoEscalones(escalones, total) {
  let actual = null;
  let siguiente = null;
  for (const e of escalones) {
    if (total >= e.desde) actual = e;
    else if (!siguiente) siguiente = e;
  }
  let descuento = 0;
  if (actual && actual.tipo === "porcentaje") descuento = Math.round((total * Math.min(actual.valor, 100)) / 100);
  if (actual && actual.tipo === "monto") descuento = Math.min(actual.valor, total);
  return { actual, siguiente, descuento, envioGratis: !!actual && actual.tipo === "envio_gratis" };
}
