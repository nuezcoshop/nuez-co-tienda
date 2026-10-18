"use client";

import { useEffect } from "react";
import { coloresDesde, esHex } from "@/lib/colores";
import { tipografiaDesde, hrefFuentes } from "@/lib/tipografia";

// Solo actúa cuando la tienda está dentro del editor del POS (?preview=1 dentro de un iframe).
// Para cualquier cliente normal no hace nada. Recibe los valores del editor y los aplica en vivo, sin guardar.
export default function VistaPrevia() {
  useEffect(() => {
    let enIframe = false;
    try { enIframe = window.parent !== window; } catch { enIframe = true; }
    if (!enIframe || new URLSearchParams(window.location.search).get("preview") !== "1") return;

    const raiz = document.querySelector(".nz-tema");
    let puestas = [];
    let estilo = document.getElementById("nz-prev-css");
    if (!estilo) { estilo = document.createElement("style"); estilo.id = "nz-prev-css"; document.head.appendChild(estilo); }
    let enlace = document.getElementById("nz-prev-fuentes");

    function aplicar(d) {
      if (!raiz || !d) return;
      const vars = { ...coloresDesde(d.color_principal, d.color_fondo, d.color_acento) };
      const tipo = tipografiaDesde(d);
      Object.assign(vars, tipo.vars);
      puestas.forEach((k) => { if (!(k in vars)) raiz.style.removeProperty(k); });
      Object.entries(vars).forEach(([k, v]) => raiz.style.setProperty(k, v));
      puestas = Object.keys(vars);
      estilo.textContent = tipo.css + (esHex(d.color_fondo) ? `\nhtml,body{background:${d.color_fondo}}` : "");
      const href = hrefFuentes(d);
      if (href) {
        if (!enlace) { enlace = document.createElement("link"); enlace.id = "nz-prev-fuentes"; enlace.rel = "stylesheet"; document.head.appendChild(enlace); }
        if (enlace.href !== href) enlace.href = href;
      } else if (enlace) { enlace.remove(); enlace = null; }
    }

    function alRecibir(e) {
      if (e.source !== window.parent || !e.data || e.data.tipo !== "nz-preview") return;
      aplicar(e.data.datos);
    }
    window.addEventListener("message", alRecibir);
    window.parent.postMessage({ tipo: "nz-listo" }, "*");
    return () => window.removeEventListener("message", alRecibir);
  }, []);
  return null;
}
