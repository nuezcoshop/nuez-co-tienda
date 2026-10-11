// Texto que se va completando palabra por palabra, en orden de lectura, mientras se desliza.
// Solo CSS (sin JavaScript en el navegador): si el navegador no lo soporta, el texto se ve normal.
// El elemento que lo contiene tiene que llevar la clase "esc-tl" (marca el avance del scroll).
export default function Escalera({ texto, activo = true }) {
  if (!activo) return String(texto || "");
  const partes = String(texto || "").split(/(\s+)/);
  const total = partes.filter((p) => p && !/^\s+$/.test(p)).length;
  const n = Math.max(1, Math.min(total, 24));
  let k = 0;
  return partes.map((p, idx) => {
    if (!p || /^\s+$/.test(p)) return p;
    const i = Math.min(k++, 24);
    return (
      <span key={idx} className="esc" style={{ "--i": i, "--n": n }}>
        {p}
      </span>
    );
  });
}
