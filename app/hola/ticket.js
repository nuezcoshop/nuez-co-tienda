import { supabase } from "@/lib/supabase";

const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");

function cantidadTexto(it) {
  const c = Number(it.cantidad) || 0;
  if (it.unidad === "kg") return c.toFixed(3).replace(/0$/, "");
  return String(Math.round(c));
}

// --- PDF mínimo hecho a mano (sin librerías): texto Helvetica + logo JPEG opcional ---
const aBytes = (str) => {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    out[i] = c < 256 ? c : 63; // lo que no entra en WinAnsi (emojis, etc.) se reemplaza por "?"
  }
  return out;
};
const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

let medidor = null;
function ancho(texto, tam, negrita) {
  if (!medidor) medidor = document.createElement("canvas").getContext("2d");
  medidor.font = `${negrita ? "bold " : ""}${tam}px Arial, Helvetica, sans-serif`; // Arial y Helvetica miden igual
  return medidor.measureText(String(texto)).width;
}

async function cargarLogo(url) {
  if (!url) return null;
  try {
    const resp = await fetch(url, { mode: "cors" });
    if (!resp.ok) return null;
    const bmp = await createImageBitmap(await resp.blob());
    const w = 420;
    const h = Math.round((bmp.height / bmp.width) * w);
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const g = cv.getContext("2d");
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, w, h);
    g.drawImage(bmp, 0, 0, w, h);
    const base64 = cv.toDataURL("image/jpeg", 0.92).split(",")[1];
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, w, h };
  } catch (e) {
    return null;
  }
}

function armarPdf(anchoPag, altoPag, contenido, logo) {
  const partes = [];
  let largo = 0;
  const offsets = [];
  const poner = (x) => {
    const b = typeof x === "string" ? aBytes(x) : x;
    partes.push(b);
    largo += b.length;
  };
  const objeto = (n, cuerpo) => {
    offsets[n] = largo;
    poner(`${n} 0 obj\n`);
    poner(cuerpo);
    poner("\nendobj\n");
  };

  poner("%PDF-1.4\n");
  objeto(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objeto(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objeto(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${anchoPag.toFixed(2)} ${altoPag.toFixed(2)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >>${
      logo ? " /XObject << /Im1 7 0 R >>" : ""
    } >> >>`
  );
  const cont = aBytes(contenido);
  offsets[4] = largo;
  poner(`4 0 obj\n<< /Length ${cont.length} >>\nstream\n`);
  poner(cont);
  poner("\nendstream\nendobj\n");
  objeto(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objeto(6, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  if (logo) {
    offsets[7] = largo;
    poner(`7 0 obj\n<< /Type /XObject /Subtype /Image /Width ${logo.w} /Height ${logo.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>\nstream\n`);
    poner(logo.bytes);
    poner("\nendstream\nendobj\n");
  }
  const total = logo ? 8 : 7;
  const inicioXref = largo;
  poner(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let i = 1; i < total; i++) poner(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  poner(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`);

  const salida = new Uint8Array(largo);
  let pos = 0;
  partes.forEach((p) => {
    salida.set(p, pos);
    pos += p.length;
  });
  return new Blob([salida], { type: "application/pdf" });
}

// Ticket digital en PDF, con el mismo formato que el ticket del local. Comprobante de compra, no es una factura.
export async function descargarTicket(token, info = {}) {
  const { data: t, error } = await supabase.rpc("ticket_publico", { t: token });
  if (error || !t) throw new Error("El ticket todavía no está listo. Probá de nuevo en unos segundos.");

  const logo = await cargarLogo(info.logo_url);
  const items = Array.isArray(t.items) ? t.items : [];
  const pagos = Array.isArray(t.pagos) ? t.pagos : [];

  const W = 226.77; // 80 mm
  const M = 14;
  const cmds = []; // se dibuja de arriba hacia abajo
  let y = 18;

  const texto = (str, { x, tam = 9, negrita = false, alinear = "left", color = "0 g" } = {}) => {
    const w = ancho(str, tam, negrita);
    const px = alinear === "center" ? (W - w) / 2 : alinear === "right" ? W - M - w : (x ?? M);
    cmds.push(`${color} BT /${negrita ? "F2" : "F1"} ${tam} Tf ${px.toFixed(2)} @Y${y.toFixed(2)}@ Td (${esc(str)}) Tj ET`);
  };
  const raya = (grosor = 0.5) => {
    cmds.push(`${grosor} w [] 0 d 0 G ${M} @Y${y.toFixed(2)}@ m ${W - M} @Y${y.toFixed(2)}@ l S`);
  };

  if (logo) {
    const lw = 150;
    const lh = (logo.h / logo.w) * lw;
    cmds.push(`q ${lw} 0 0 ${lh.toFixed(2)} ${((W - lw) / 2).toFixed(2)} @Y${(y + lh).toFixed(2)}@ cm /Im1 Do Q`);
    y += lh + 12;
  } else {
    y += 14;
    texto("Nuez Co", { tam: 18, negrita: true, alinear: "center" });
    y += 16;
  }

  const f = new Date(t.fecha);
  texto(`${f.toLocaleDateString("es-AR")} ${f.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`, { tam: 8, alinear: "center", color: "0.45 g" });
  y += 14;
  texto(`Venta #${t.numero}`, { tam: 11, negrita: true, alinear: "center" });
  y += 9;
  raya();
  y += 13;

  texto("Cant", { tam: 8.5, negrita: true });
  texto("Producto", { x: M + 38, tam: 8.5, negrita: true });
  texto("Total", { tam: 8.5, negrita: true, alinear: "right" });
  y += 7;

  items.forEach((it) => {
    y += 11;
    const cant = cantidadTexto(it);
    texto(cant, { tam: 9 });
    let nombre = String(it.nombre || "Producto");
    const maxW = W - M - (M + 38) - 52;
    while (nombre.length > 4 && ancho(nombre, 9, true) > maxW) nombre = nombre.slice(0, -2);
    if (nombre !== String(it.nombre || "Producto")) nombre = nombre.trimEnd() + "...";
    texto(nombre, { x: M + 38, tam: 9, negrita: true });
    texto(money(it.subtotal), { tam: 9, negrita: true, alinear: "right" });
    const c = Number(it.cantidad) || 0;
    if (c > 0) {
      y += 9.5;
      texto(`${cant} x ${money(Number(it.subtotal) / c)}`, { x: M + 38, tam: 7.5, color: "0.45 g" });
    }
    y += 2;
  });

  y += 7;
  raya();
  y += 11;
  if (Number(t.descuento) > 0) {
    y += 8;
    texto("Descuento", { tam: 9 });
    texto("-" + money(t.descuento), { tam: 9, alinear: "right" });
    y += 6;
  }
  if (Number(t.redondeo) !== 0) {
    y += 8;
    texto("Redondeo", { tam: 9 });
    texto(money(t.redondeo), { tam: 9, alinear: "right" });
    y += 6;
  }
  y += 12;
  texto("TOTAL:", { tam: 14, negrita: true });
  texto(money(t.total), { tam: 14, negrita: true, alinear: "right" });
  y += 9;
  raya();
  y += 15;

  const medioTexto = (m) => (/^transferencia/i.test(m) ? "Transferencia" : m);
  const medios = [...new Set(pagos.map((p) => medioTexto(p.medio)))];
  if (medios.length) {
    texto(`Pago: ${medios.join(" + ")}`, { tam: 9, alinear: "center" });
    y += 20;
  }
  if (info.instagram) {
    const u = String(info.instagram).replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").split(/[/?#]/)[0];
    if (u) {
      texto(`Seguinos en instagram @${u}`, { tam: 9.5, negrita: true, alinear: "center" });
      y += 18;
    }
  }
  texto("* Documento no válido como factura", { tam: 7.5, alinear: "center", color: "0.5 g" });
  y += 20;

  const alto = y;
  const contenido = cmds.map((c) => c.replace(/@Y([\d.]+)@/g, (_, v) => (alto - parseFloat(v)).toFixed(2))).join("\n");
  const pdf = armarPdf(W, alto, contenido, logo);

  const url = URL.createObjectURL(pdf);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ticket-nuez-co-${t.numero}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}
