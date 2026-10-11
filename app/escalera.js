"use client";

import { useEffect, useRef } from "react";

// Texto que se completa palabra por palabra, una tras otra, cuando aparece en pantalla.
// Si el navegador no puede (o el celular tiene "quitar animaciones"), el texto se ve normal.
export default function Escalera({ texto, activo = true }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !activo) return;
    try {
      if (
        document.documentElement.classList.contains("lite") ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        !("IntersectionObserver" in window)
      )
        return;
    } catch (e) {
      return;
    }
    el.setAttribute("data-esc", "pre");
    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          el.setAttribute("data-esc", "go");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [texto, activo]);

  if (!activo) return String(texto || "");
  const partes = String(texto || "").split(/(\s+)/);
  let k = 0;
  return (
    <span ref={ref} className="esc-grupo">
      {partes.map((p, idx) => {
        if (!p || /^\s+$/.test(p)) return p;
        const i = Math.min(k++, 40);
        return (
          <span key={idx} className="esc" style={{ "--i": i }}>
            {p}
          </span>
        );
      })}
    </span>
  );
}
