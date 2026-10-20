// Utilidades de precios, stock y formato para la tienda.

export function normalizarTexto(texto) {
  return (texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function money(n) {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

// Promoción "lleva N, paga M" (2x1, 3x2...) en productos que se venden por unidad.
export function promoNxM(row) {
  const n = Number(row && row.promo_lleva);
  const m = Number(row && row.promo_paga);
  if (!row || row.unidad === "kg" || !(n >= 2) || !(m >= 1) || !(m < n)) return null;
  return { lleva: n, paga: m, texto: `${n}x${m}` };
}

// Cuánto se paga por "cantidad" unidades con la promo (lo que sobra de los grupos completos se paga entero).
function totalConPromo(row, promo, cantidad) {
  const base = Number(row.precio_venta) || 0;
  const q = Math.max(0, Math.floor(Number(cantidad) || 0));
  const grupos = Math.floor(q / promo.lleva);
  return (grupos * promo.paga + (q - grupos * promo.lleva)) * base;
}

// Misma regla que el sistema POS: el último tramo cuyo "desde" alcanza la cantidad es el que manda.
// Con promo NxM, el "precio por unidad" es el promedio de lo que se paga (total / cantidad).
export function precioPorCantidad(row, cantidad) {
  const promo = promoNxM(row);
  if (promo && cantidad > 0) return totalConPromo(row, promo, cantidad) / cantidad;
  let precio = Number(row.precio_venta) || 0;
  const tramos = [...(row.tramos || [])].sort((a, b) => a.desde - b.desde);
  for (const t of tramos) {
    if (cantidad >= Number(t.desde)) precio = Number(t.precio);
  }
  return precio;
}

// Total de la línea (precio × cantidad), exacto también con promo NxM.
export function totalPorCantidad(row, cantidad) {
  const promo = promoNxM(row);
  if (promo) return totalConPromo(row, promo, cantidad);
  return precioPorCantidad(row, cantidad) * cantidad;
}

// Ahorro real por precio por cantidad o por promo NxM, sobre la misma cantidad. Si no hay ahorro, es 0.
export function ahorroPorCantidad(row, cantidad) {
  const base = Number(row.precio_venta) || 0;
  if (promoNxM(row)) return Math.max(0, base * cantidad - totalPorCantidad(row, cantidad));
  const efectivo = precioPorCantidad(row, cantidad);
  return efectivo < base ? (base - efectivo) * cantidad : 0;
}

// Sugerencia de pasar al próximo tramo que de verdad baje el precio.
// totalActual = lo que ya hay en el carrito + lo que se está eligiendo; agregando = lo que se está eligiendo ahora.
// Devuelve null si no hay un tramo superior más conveniente (o no alcanza el stock).
export function sugerenciaTramo(row, totalActual, agregando, paso, maxAgregable) {
  const tramos = [...(row.tramos || [])].sort((a, b) => a.desde - b.desde);
  const actual = precioPorCantidad(row, totalActual);
  const prox = tramos.find((t) => Number(t.desde) > totalActual + 1e-9 && Number(t.precio) < actual - 1e-9);
  if (!prox) return null;
  const yaTenia = totalActual - agregando;
  const falta = Number(prox.desde) - yaTenia; // cuánto habría que agregar para llegar al tramo
  const nuevaCant = Math.round(Math.ceil(falta / paso - 1e-9) * paso * 1000) / 1000;
  if (nuevaCant <= agregando + 1e-9 || nuevaCant > maxAgregable + 1e-9) return null;
  if (yaTenia + nuevaCant > 4 * Math.max(totalActual, 1e-9)) return null; // muy lejos: no tiene sentido sugerirlo
  const precioNuevo = Number(prox.precio);
  const extra = precioNuevo * nuevaCant - actual * agregando;
  if (extra <= 0) return null;
  const ahorroTotal = Math.round(ahorroPorCantidad(row, yaTenia + nuevaCant));
  return { cantidad: nuevaCant, extra, precioNuevo, ahorroPorUnidad: actual - precioNuevo, ahorroTotal };
}

export function formatoCantidad(cantidad, unidad) {
  if (unidad === "kg") {
    if (cantidad < 1) return Math.round(cantidad * 1000) + " g";
    return String(Math.round(cantidad * 100) / 100).replace(".", ",") + " kg";
  }
  return cantidad + (cantidad === 1 ? " un." : " un.");
}

// Cuánto se puede vender de un producto (en su unidad). Un paquete también cuenta lo que se
// podría empaquetar con el stock suelto del ingrediente.
export function disponible(row) {
  const propio = Math.max(Number(row.stock_total) || 0, 0);
  if (row.ingrediente_id && Number(row.cantidad_por_unidad) > 0) {
    const extra = Math.floor(Math.max(Number(row.stock_ingrediente) || 0, 0) / Number(row.cantidad_por_unidad) + 1e-9);
    return Math.floor(propio + 1e-9) + extra;
  }
  return row.unidad === "kg" ? Math.floor(propio * 100) / 100 : Math.floor(propio + 1e-9);
}

// Agrupa los productos como se ven en la tienda:
//  - "variantes": un producto a granel con paquetes ya armados (100 g, 250 g, 1 kg...)
//  - "peso": producto que se vende por kilo (se elige cuánto llevar)
//  - "unidad": producto que se vende por unidad
export function armarCatalogo(rows) {
  // Precio online: si el producto tiene un precio solo para la tienda (más barato), ése es el que se cobra y
// el del local queda como "precio_lista" (para mostrarlo tachado).
  const lista = (rows || []).map((r) => {
    const base = Number(r.precio_venta) || 0;
    const online = Number(r.precio_online) || 0;
    if (!r.es_combo && online > 0 && online < base) {
      return { ...r, precio_venta: online, precio_lista: base, pct_online: Math.round((1 - online / base) * 100) };
    }
    return { ...r, precio_venta: base };
  });
  const porId = {};
  lista.forEach((r) => (porId[r.id] = r));

  const paquetesDe = {};
  lista.forEach((r) => {
    if (r.ingrediente_id && porId[r.ingrediente_id]) {
      (paquetesDe[r.ingrediente_id] = paquetesDe[r.ingrediente_id] || []).push(r);
    }
  });
  const esPaqueteAgrupado = (r) => r.ingrediente_id && porId[r.ingrediente_id];

  const items = lista
    .filter((r) => !esPaqueteAgrupado(r))
    .map((r) => {
      const variantes = (paquetesDe[r.id] || []).sort((a, b) => Number(a.cantidad_por_unidad) - Number(b.cantidad_por_unidad));
      const tipo = variantes.length > 0 ? "variantes" : r.unidad === "kg" ? "peso" : "unidad";
      const opciones = tipo === "variantes" ? variantes : [r];
      const hayStock = opciones.some((o) => disponible(o) > 0);
      return { ...r, tipo, variantes, hayStock };
    });

  return { items, porId };
}
