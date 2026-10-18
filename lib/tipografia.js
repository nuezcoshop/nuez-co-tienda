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

export const BORDES = [
  { v: 0, n: "Sin borde" },
  { v: 1, n: "Muy fino" },
  { v: 2, n: "Normal" },
  { v: 3, n: "Grueso" },
  { v: 4, n: "Muy grueso" },
];
export const SOMBRAS = [
  { v: "", n: "Sin sombra" },
  { v: "suave", n: "Suave", css: "0 2px 8px rgba(0,0,0,.10)" },
  { v: "media", n: "Media", css: "0 4px 14px rgba(0,0,0,.18)" },
  { v: "fuerte", n: "Marcada", css: "0 6px 20px rgba(0,0,0,.28)" },
];
const GRUPOS_BORDE = { chips: ".chip-tienda", botones: ".btn-tienda", buscador: ".buscador-tienda" };

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
  // Bordes (grosor) y sombras de selectores de categoría, botones y buscador.
  for (const [g, sel2] of Object.entries(GRUPOS_BORDE)) {
    const d = [];
    const w = c["borde_" + g];
    if (w !== null && w !== undefined && w !== "" && Number(w) >= 0 && Number(w) <= 4) {
      d.push(`border-width:${Number(w)}px`);
      if (Number(w) > 0) d.push("border-style:solid", "border-color:var(--verde)");
    }
    const sh = SOMBRAS.find((x) => x.v && x.v === c["sombra_" + g]);
    if (sh) d.push(`box-shadow:${sh.css}`);
    if (d.length) reglas.push(`.nz-tema ${sel2}{${d.join(";")}}`);
  }
  // Tarjetas de producto con fondo de color (rotan entre principal, acento y principal oscuro).
  if (c.tarjetas_estilo === "colores") {
    const P = ".nz-tema .tarjeta-prod";
    const col = [
      ["var(--verde)", "var(--fondo)", "var(--acento)", "var(--sobre-acento)"],
      ["var(--acento)", "var(--sobre-acento)", "var(--verde)", "var(--fondo)"],
      ["var(--verde-oscuro)", "var(--fondo)", "var(--acento)", "var(--sobre-acento)"],
    ];
    reglas.push(`${P}{border-radius:1.25rem;padding:.55rem}`);
    col.forEach(([bg, tx, mbg, mtx], v) => {
      reglas.push(`${P}[data-v="${v}"]{background:${bg}}`);
      reglas.push(`${P}[data-v="${v}"] :is(.info-tarjeta, .t-titulo, .precio-tarjeta){color:${tx} !important}`);
      reglas.push(`${P}[data-v="${v}"] .mas-tarjeta{background:${mbg};color:${mtx}}`);
    });
  }
  // Banner principal: ancho completo (sin márgenes ni bordes redondeados) y alto.
  const completo = c.banner_estilo === "completo";
  const alto = ["bajo", "medio"].includes(c.banner_alto) ? c.banner_alto : "";
  if (completo) {
    reglas.push(".nz-tema .banner-principal{padding-left:0;padding-right:0}");
    reglas.push(".nz-tema .banner-principal .bn-caja{max-width:none;margin-top:0}");
    reglas.push(".nz-tema .banner-principal .bn-pista{border-radius:0}");
  }
  if (alto) {
    const m = alto === "bajo" ? "3/2" : "1/1";
    const d = alto === "bajo" ? "3/1" : "12/5";
    reglas.push(`@media (max-width:767px){.nz-tema .banner-principal .bn-slide{aspect-ratio:${m}}}`);
    if (completo) reglas.push(`@media (min-width:768px){.nz-tema .banner-principal .bn-slide{aspect-ratio:${d}}}`);
  } else if (completo) {
    reglas.push("@media (min-width:768px){.nz-tema .banner-principal .bn-slide{aspect-ratio:2/1}}");
  }
  if (esHex(c.color_boton_texto)) vars["--sobre-acento"] = c.color_boton_texto;
  return { vars, css: reglas.join("\n") };
}
