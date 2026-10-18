// Tipografía, tamaños y colores de texto/botones de la tienda (se eligen en "Tienda online" del POS).
// Esta misma lista se usa en el POS (vista previa) y en la tienda. Cada fuente se carga desde Google Fonts
// SOLO si está elegida, así la tienda no se vuelve más lenta.
import { esHex, mezclar } from "./colores";

export const FUENTES = [
  { id: "montserrat", nombre: "Montserrat (actual)", css: "'Montserrat', sans-serif", gf: null },
  { id: "poppins", nombre: "Poppins", css: "'Poppins', sans-serif", gf: "Poppins:wght@300;400;500;600;700;800" },
  { id: "nunito", nombre: "Nunito (redondeada)", css: "'Nunito', sans-serif", gf: "Nunito:wght@300;400;500;600;700;800" },
  { id: "quicksand", nombre: "Quicksand (suave)", css: "'Quicksand', sans-serif", gf: "Quicksand:wght@300;400;500;600;700" },
  { id: "raleway", nombre: "Raleway (elegante)", css: "'Raleway', sans-serif", gf: "Raleway:wght@300;400;500;600;700;800" },
  { id: "lato", nombre: "Lato", css: "'Lato', sans-serif", gf: "Lato:wght@300;400;700;900" },
  { id: "playfair", nombre: "Playfair Display (clásica)", css: "'Playfair Display', serif", gf: "Playfair+Display:wght@400;500;600;700;800" },
  { id: "lora", nombre: "Lora (con serif)", css: "'Lora', serif", gf: "Lora:wght@400;500;600;700" },
  { id: "merriweather", nombre: "Merriweather", css: "'Merriweather', serif", gf: "Merriweather:wght@300;400;700;900" },
  { id: "dmserif", nombre: "DM Serif Display (títulos)", css: "'DM Serif Display', serif", gf: "DM+Serif+Display" },
  { id: "oswald", nombre: "Oswald (angosta, fuerte)", css: "'Oswald', sans-serif", gf: "Oswald:wght@300;400;500;600;700" },
  { id: "fredoka", nombre: "Fredoka (divertida)", css: "'Fredoka', sans-serif", gf: "Fredoka:wght@300;400;500;600;700" },
  { id: "pacifico", nombre: "Pacifico (manuscrita, solo títulos)", css: "'Pacifico', cursive", gf: "Pacifico" },
];

export const TAMANOS = [
  { v: 90, n: "Chico" },
  { v: 100, n: "Normal" },
  { v: 110, n: "Grande" },
  { v: 125, n: "Muy grande" },
];

export const GROSORES = [
  { v: 300, n: "Fina (Light)" },
  { v: 400, n: "Normal" },
  { v: 500, n: "Media" },
  { v: 600, n: "Seminegrita" },
  { v: 700, n: "Negrita" },
  { v: 800, n: "Extranegrita" },
];

export const fuentePorId = (id) => FUENTES.find((f) => f.id === id) || null;

// Link de Google Fonts con las fuentes elegidas (o null si no hace falta cargar ninguna).
export function hrefFuentes(c) {
  const ids = [c.fuente_titulos, c.fuente_textos, c.fuente_botones].filter(Boolean);
  const gf = [...new Set(ids.map((i) => fuentePorId(i)?.gf).filter(Boolean))];
  if (gf.length === 0) return null;
  return "https://fonts.googleapis.com/css2?" + gf.map((f) => "family=" + f).join("&") + "&display=swap";
}

const peso = (v) => (GROSORES.some((g) => g.v === Number(v)) ? Number(v) : null);

const tam = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 80 && n <= 140 && n !== 100 ? n / 100 : null;
};

// Devuelve { vars, css }: variables de color para el contenedor de la tienda y el CSS de tipografía/tamaños.
// Solo se escribe lo que se eligió: si no hay nada elegido, la tienda queda exactamente como siempre.
export function tipografiaDesde(c) {
  const vars = {};
  const reglas = [];
  const fT = fuentePorId(c.fuente_titulos);
  const fX = fuentePorId(c.fuente_textos);
  const fB = fuentePorId(c.fuente_botones);
  const sel = ".nz-tema :is(h1, h2:not(.sin-tema), h3, .t-titulo)";

  if (fX) reglas.push(`.nz-tema{font-family:${fX.css}}`);
  if (fT || esHex(c.color_titulos) || tam(c.tam_titulos) || peso(c.peso_titulos)) {
    const d = [];
    if (fT) d.push(`font-family:${fT.css}`);
    if (esHex(c.color_titulos)) d.push(`color:${c.color_titulos} !important`);
    if (tam(c.tam_titulos)) d.push(`zoom:${tam(c.tam_titulos)}`);
    if (peso(c.peso_titulos)) d.push(`font-weight:${peso(c.peso_titulos)}`);
    reglas.push(`${sel}{${d.join(";")}}`);
  }
  if (esHex(c.color_textos)) {
    // Los textos de la tienda usan estos dos tonos: se reemplazan por el color elegido.
    vars["--tinta"] = c.color_textos;
    vars["--tinta-suave"] = mezclar(c.color_textos, 0.78, 255);
  }
  if (tam(c.tam_textos) || peso(c.peso_textos)) {
    const d = [];
    if (tam(c.tam_textos)) d.push(`zoom:${tam(c.tam_textos)}`);
    if (peso(c.peso_textos)) d.push(`font-weight:${peso(c.peso_textos)}`);
    reglas.push(`.nz-tema .txt-desc{${d.join(";")}}`);
  }
  if (fB || peso(c.peso_botones) || tam(c.tam_botones)) {
    if (fB || peso(c.peso_botones)) reglas.push(`.nz-tema button{${[fB ? `font-family:${fB.css}` : "", peso(c.peso_botones) ? `font-weight:${peso(c.peso_botones)}` : ""].filter(Boolean).join(";")}}`);
    if (tam(c.tam_botones)) reglas.push(`.nz-tema .btn-tienda{zoom:${tam(c.tam_botones)}}`);
  }
  if (esHex(c.color_boton_texto)) vars["--sobre-acento"] = c.color_boton_texto;
  return { vars, css: reglas.join("\n") };
}
