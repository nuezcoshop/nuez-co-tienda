// Utilidades de precios, stock y formato para la tienda.

export function normalizarTexto(texto) {
  return (texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function money(n) {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

// Misma regla que el sistema POS: el último tramo cuyo "desde" alcanza la cantidad es el que manda.
export function precioPorCantidad(row, cantidad) {
  let precio = Number(row.precio_venta) || 0;
  const tramos = [...(row.tramos || [])].sort((a, b) => a.desde - b.desde);
  for (const t of tramos) {
    if (cantidad >= Number(t.desde)) precio = Number(t.precio);
  }
  return precio;
}

// Ahorro real por precio por cantidad: diferencia entre el precio base (el que rige sin tramos)
// y el precio del tramo alcanzado, sobre la misma cantidad. Si no hay tramo alcanzado, es 0.
export function ahorroPorCantidad(row, cantidad) {
  const base = Number(row.precio_venta) || 0;
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
  const lista = (rows || []).map((r) => ({ ...r, precio_venta: Number(r.precio_venta) || 0 }));
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
