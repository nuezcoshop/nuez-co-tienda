"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

// Cuenta la visita (una por sesión de navegación). Si algo falla, no pasa nada: la tienda sigue igual.
export default function Visitas() {
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("preview") === "1") return; // vista previa del editor del POS
      if (navigator.webdriver || /bot|crawler|spider|headless|preview/i.test(navigator.userAgent)) return;
      if (sessionStorage.getItem("nuez_visita")) return;
      sessionStorage.setItem("nuez_visita", "1");
      const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
      let nuevo = true;
      try {
        if (localStorage.getItem("nuez_visitante") === hoy) nuevo = false;
        else localStorage.setItem("nuez_visitante", hoy);
      } catch (e) {}
      // Se espera un momento para no competir con la carga de la tienda.
      setTimeout(() => {
        try {
          Promise.resolve(supabase.rpc("registrar_visita", { p_nuevo_visitante: nuevo })).catch(() => {});
        } catch (e) {}
      }, 2500);
    } catch (e) {}
  }, []);
  return null;
}
