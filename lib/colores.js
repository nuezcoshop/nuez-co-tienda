// A partir de un color "#rrggbb" arma el color oscuro (botón apretado) y el claro (fondos suaves).
export const esHex = (h) => /^#[0-9a-fA-F]{6}$/.test(h || "");
export function mezclar(hex, k, base) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return "#" + [r, g, b].map((v) => Math.round(v * k + base * (1 - k)).toString(16).padStart(2, "0")).join("");
}
export function coloresDesde(hex, fondo, acento) {
  const vars = {};
  if (esHex(hex)) {
    vars["--verde"] = hex;
    vars["--verde-oscuro"] = mezclar(hex, 0.78, 0);
    vars["--verde-claro"] = mezclar(hex, 0.12, 255);
    // Textos en tonos del color principal (en vez de negro/gris) para que todo combine.
    vars["--tinta"] = mezclar(hex, 0.6, 0);
    vars["--tinta-suave"] = mezclar(hex, 0.7, 255);
  }
  if (esHex(fondo)) {
    vars["--fondo"] = fondo;
    vars["--fondo-suave"] = mezclar(fondo, 0.95, 0); // un poquito más oscuro, para buscador y relleno
  }
  // Color de acento (rellenos de botones y detalles). Si no se eligió, se usa el principal.
  const base = esHex(acento) ? acento : esHex(hex) ? hex : "#2f7a55";
  const n = parseInt(base.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  vars["--acento"] = base;
  // Texto sobre el acento: el color principal si contrasta bien; si no, oscuro o blanco.
  const lumDe = (h) => { const m = parseInt(h.slice(1), 16); return (0.299 * ((m >> 16) & 255) + 0.587 * ((m >> 8) & 255) + 0.114 * (m & 255)) / 255; };
  const principal = esHex(hex) ? hex : null;
  vars["--sobre-acento"] = principal && Math.abs(lumDe(principal) - lum) > 0.3 ? principal : lum > 0.62 ? "#2a2018" : "#ffffff";
  return vars;
}

