import { supabase } from "@/lib/supabase";

const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
const cant = (it) => {
  const c = Number(it.cantidad) || 0;
  return it.unidad === "kg" ? (c >= 1 ? `${c.toFixed(3).replace(/\.?0+$/, "")} kg` : `${Math.round(c * 1000)} g`) : `${c} un.`;
};

// Arma el ticket digital como imagen y lo descarga. Es un comprobante de compra, no una factura.
export async function descargarTicket(token, direccion) {
  const { data: t, error } = await supabase.rpc("ticket_publico", { t: token });
  if (error || !t) throw new Error("El ticket todavía no está listo. Probá de nuevo en unos segundos.");

  const items = Array.isArray(t.items) ? t.items : [];
  const pagos = Array.isArray(t.pagos) ? t.pagos : [];
  const ancho = 640;
  const margen = 36;
  const filas = items.length + pagos.length;
  const alto = 380 + filas * 36 + (Number(t.descuento) > 0 ? 36 : 0) + (Number(t.redondeo) !== 0 ? 36 : 0);
  const escala = 2;
  const cv = document.createElement("canvas");
  cv.width = ancho * escala;
  cv.height = alto * escala;
  const g = cv.getContext("2d");
  g.scale(escala, escala);
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, ancho, alto);
  g.fillStyle = "#3a2a1a";
  let y = 60;

  const texto = (txt, x, yy, { tam = 20, peso = "400", alinear = "left", color = "#3a2a1a" } = {}) => {
    g.font = `${peso} ${tam}px Arial, sans-serif`;
    g.fillStyle = color;
    g.textAlign = alinear;
    g.fillText(String(txt), x, yy);
  };
  const linea = (yy) => {
    g.strokeStyle = "#d9cdbd";
    g.setLineDash([6, 5]);
    g.beginPath();
    g.moveTo(margen, yy);
    g.lineTo(ancho - margen, yy);
    g.stroke();
    g.setLineDash([]);
  };

  texto("Nuez Co", ancho / 2, y, { tam: 34, peso: "700", alinear: "center", color: "#7a4b32" });
  y += 28;
  if (direccion) {
    texto(direccion, ancho / 2, y, { tam: 16, alinear: "center", color: "#8a7a6a" });
    y += 24;
  }
  const f = new Date(t.fecha);
  texto(`Compra #${t.numero} · ${f.toLocaleDateString("es-AR")} ${f.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`, ancho / 2, y, { tam: 16, alinear: "center", color: "#8a7a6a" });
  y += 22;
  linea(y);
  y += 34;

  items.forEach((it) => {
    const nombre = String(it.nombre || "Producto");
    texto(nombre.length > 34 ? nombre.slice(0, 33) + "…" : nombre, margen, y, { tam: 19, peso: "600" });
    texto(money(it.subtotal), ancho - margen, y, { tam: 19, peso: "600", alinear: "right" });
    y += 22;
    texto(cant(it), margen, y, { tam: 15, color: "#8a7a6a" });
    y += 14;
  });
  y += 4;
  linea(y);
  y += 34;

  if (Number(t.descuento) > 0) {
    texto("Descuento", margen, y, { tam: 18 });
    texto("-" + money(t.descuento), ancho - margen, y, { tam: 18, alinear: "right" });
    y += 36;
  }
  if (Number(t.redondeo) !== 0) {
    texto("Redondeo", margen, y, { tam: 18 });
    texto(money(t.redondeo), ancho - margen, y, { tam: 18, alinear: "right" });
    y += 36;
  }
  texto("TOTAL", margen, y, { tam: 26, peso: "700" });
  texto(money(t.total), ancho - margen, y, { tam: 26, peso: "700", alinear: "right" });
  y += 40;
  pagos.forEach((p) => {
    texto(`Pagado con ${p.medio}`, margen, y, { tam: 16, color: "#8a7a6a" });
    texto(money(p.importe), ancho - margen, y, { tam: 16, color: "#8a7a6a", alinear: "right" });
    y += 26;
  });
  y += 10;
  linea(y);
  y += 32;
  texto("¡Gracias por elegirnos! 💛", ancho / 2, y, { tam: 20, peso: "600", alinear: "center", color: "#7a4b32" });
  y += 24;
  texto("Comprobante de compra. No válido como factura.", ancho / 2, y, { tam: 13, alinear: "center", color: "#a09080" });

  const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ticket-nuez-co-${t.numero}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
