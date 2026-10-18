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
    let primera = false;
    let estilo = document.getElementById("nz-prev-css");
    if (!estilo) { estilo = document.createElement("style"); estilo.id = "nz-prev-css"; document.head.appendChild(estilo); }
    let enlace = document.getElementById("nz-prev-fuentes");

    function aplicar(d) {
      if (!raiz || !d) return;
      if (!primera) {
        // Primera vez: se desactivan los estilos guardados (si no, taparían lo que se prueba acá).
        primera = true;
        const guardado = document.getElementById("nz-tipo-css");
        if (guardado && guardado.sheet) guardado.sheet.disabled = true;
        raiz.removeAttribute("style");
        raiz.style.setProperty("color", "var(--tinta)");
      }
      const vars = { ...coloresDesde(d.color_principal, d.color_fondo, d.color_acento) };
      const tipo = tipografiaDesde(d);
      Object.assign(vars, tipo.vars);
      puestas.forEach((k) => { if (!(k in vars)) raiz.style.removeProperty(k); });
      Object.entries(vars).forEach(([k, v]) => raiz.style.setProperty(k, v));
      puestas = Object.keys(vars);
      // Orden y visibilidad de los bloques del inicio, en vivo.
      const b = d.bloques_inicio || {};
      const base = ["destacados", "banners", "nosotros", "visitanos"];
      const orden = [...(Array.isArray(b.orden) ? b.orden : []), ...base].filter((x, i, a) => base.includes(x) && a.indexOf(x) === i);
      const ocultos = Array.isArray(b.ocultos) ? b.ocultos : [];
      document.querySelectorAll("[data-bloque]").forEach((el) => {
        const id = el.getAttribute("data-bloque");
        el.style.display = ocultos.includes(id) ? "none" : "";
        if (id !== "banner") el.style.order = String(orden.indexOf(id));
      });
      estilo.textContent = tipo.css + (esHex(d.color_fondo) ? `\nhtml,body{background:${d.color_fondo}}` : "");
      const href = hrefFuentes(d);
      if (href) {
        if (!enlace) { enlace = document.createElement("link"); enlace.id = "nz-prev-fuentes"; enlace.rel = "stylesheet"; document.head.appendChild(enlace); }
        if (enlace.href !== href) enlace.href = href;
      } else if (enlace) { enlace.remove(); enlace = null; }
    }

    // Resaltado de lo que se puede tocar y de lo que está seleccionado en el editor.
    const T = "h1, h2:not(.sin-tema), h3, .t-titulo";
    const resaltado = document.createElement("style");
    resaltado.textContent = `
      main:has(> [data-bloque]){display:flex;flex-direction:column}
      .nz-tema button,.nz-tema a{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
      .nz-tema :is(${T}, .txt-desc, button:not(.tarjeta-prod)):hover{outline:2px dashed #14b8a6;outline-offset:2px;cursor:pointer}
      .nz-tema[data-sel="titulos"] :is(${T}){outline:2px solid #14b8a6;outline-offset:2px}
      .nz-tema[data-sel="textos"] .txt-desc{outline:2px solid #14b8a6;outline-offset:2px}
      .nz-tema[data-sel="botones"] button:not(.tarjeta-prod){outline:2px solid #14b8a6;outline-offset:2px}`;
    document.head.appendChild(resaltado);

    function bloqueDe(el) {
      if (el.closest(T)) return "titulos";
      if (el.closest(".chip-tienda, .buscador-tienda")) return "bordes";
      if (el.closest(".txt-desc")) return "textos";
      if (el.closest("button:not(.tarjeta-prod), .btn-tienda, a")) return "botones";
      return "general";
    }
    // Toque corto: funciona normal (navega) y deja seleccionado lo tocado.
    // Mantener apretado: solo selecciona para editar, sin navegar ni ejecutar nada.
    let suprimir = false;
    let timer = null;
    function alBajar(e) {
      const el = e.target instanceof Element ? e.target : null;
      if (!el || !el.closest(".nz-tema")) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        suprimir = true;
        window.parent.postMessage({ tipo: "nz-click", bloque: bloqueDe(el) }, "*");
        setTimeout(() => { suprimir = false; }, 700);
      }, 500);
    }
    function cancelar() { clearTimeout(timer); }
    function alTocar(e) {
      const el = e.target instanceof Element ? e.target : null;
      if (!el || !el.closest(".nz-tema")) return;
      cancelar();
      if (suprimir) { e.preventDefault(); e.stopPropagation(); suprimir = false; return; }
      if (el.closest("a")) e.preventDefault(); // los enlaces de afuera no se abren
      window.parent.postMessage({ tipo: "nz-click", bloque: bloqueDe(el) }, "*");
    }
    const sinMenu = (e) => e.preventDefault();
    document.addEventListener("pointerdown", alBajar, true);
    document.addEventListener("pointerup", cancelar, true);
    document.addEventListener("pointercancel", cancelar, true);
    document.addEventListener("contextmenu", sinMenu, true);
    document.addEventListener("click", alTocar, true);

    function alRecibir(e) {
      if (e.source !== window.parent || !e.data) return;
      if (e.data.tipo === "nz-preview") aplicar(e.data.datos);
      if (e.data.tipo === "nz-sel" && raiz) raiz.dataset.sel = e.data.bloque || "";
    }
    window.addEventListener("message", alRecibir);
    window.parent.postMessage({ tipo: "nz-listo" }, "*");
    return () => {
      window.removeEventListener("message", alRecibir);
      document.removeEventListener("click", alTocar, true);
      document.removeEventListener("pointerdown", alBajar, true);
      document.removeEventListener("pointerup", cancelar, true);
      document.removeEventListener("pointercancel", cancelar, true);
      document.removeEventListener("contextmenu", sinMenu, true);
      resaltado.remove();
    };
  }, []);
  return null;
}
