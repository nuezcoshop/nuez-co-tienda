// Texto que se va completando palabra por palabra al deslizar (en escalera).
// Solo CSS (sin JavaScript en el navegador): si el navegador no lo soporta, el texto se ve normal.
export default function Escalera({ texto, activo = true }) {
  if (!activo) return String(texto || "");
  const partes = String(texto || "").split(/(\s+)/);
  let n = 0;
  return partes.map((p, k) => {
    if (!p || /^\s+$/.test(p)) return p;
    const i = Math.min(n++, 12);
    return (
      <span key={k} className="esc" style={{ "--i": i }}>
        {p}
      </span>
    );
  });
}
