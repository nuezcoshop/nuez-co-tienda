"use client";

import { useEffect, useState } from "react";

// Pop up de bienvenida: aparece a los 6 segundos y se vuelve a mostrar en la próxima visita.
export default function Popup({ titulo, boton, link, letraChica }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("nuez_popup_visto")) return;
    } catch (e) {}
    const t = setTimeout(() => setVisible(true), 6000);
    return () => clearTimeout(t);
  }, []);

  function cerrar() {
    setVisible(false);
    try {
      sessionStorage.setItem("nuez_popup_visto", "1");
    } catch (e) {}
  }

  if (!visible) return null;

  const estiloBoton = {
    background: "var(--fondo, #fff)",
    color: "var(--verde, #2f7a55)",
  };
  const clase = "block w-full rounded-full py-3.5 px-5 text-center text-base font-extrabold active:scale-[0.98] transition-transform";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 fundir"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={cerrar}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-md rounded-[2rem] px-6 pt-14 pb-8 text-center subir"
        style={{ background: "var(--verde, #2f7a55)", color: "var(--fondo, #fff)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={cerrar}
          aria-label="Cerrar"
          className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full"
          style={{ color: "var(--fondo, #fff)" }}
        >
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        </button>
        {titulo && <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-6 whitespace-pre-line">{titulo}</h2>}
        {boton &&
          (link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" onClick={cerrar} className={clase} style={estiloBoton}>
              {boton}
            </a>
          ) : (
            <button onClick={cerrar} className={clase} style={estiloBoton}>
              {boton}
            </button>
          ))}
        {letraChica && <p className="mt-5 text-sm font-medium leading-relaxed opacity-90 whitespace-pre-line">{letraChica}</p>}
      </div>
    </div>
  );
}
