"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function BajaAviso() {
  const [estado, setEstado] = useState("cargando");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t");
    if (!t) {
      setEstado("error");
      return;
    }
    supabase.rpc("baja_avisos_stock", { p_token: t }).then(({ data, error }) => setEstado(error ? "error" : data === "ok" ? "ok" : "noencontrado"));
  }, []);

  const texto =
    estado === "cargando" ? "Procesando..." :
    estado === "ok" ? "Listo, no vas a recibir más avisos de stock." :
    estado === "noencontrado" ? "Ya no tenés avisos pendientes." :
    "No pudimos procesar el pedido. Probá de nuevo más tarde.";

  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <p className="text-lg font-bold mb-3">{texto}</p>
        <a href="/" className="underline">Volver a la tienda</a>
      </div>
    </main>
  );
}
