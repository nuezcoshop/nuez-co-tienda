"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function BajaNewsletter() {
  const [estado, setEstado] = useState("cargando");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t");
    if (!t) {
      setEstado("error");
      return;
    }
    supabase.rpc("baja_newsletter", { p_token: t }).then(({ data, error }) => setEstado(error ? "error" : data === "ok" ? "ok" : data === "ya_baja" ? "noencontrado" : "error"));
  }, []);

  const texto =
    estado === "cargando" ? "Procesando..." :
    estado === "ok" ? "Listo, no vas a recibir más novedades de Nuez Co." :
    estado === "noencontrado" ? "Ya estabas dado de baja." :
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
