"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");

function cantidadTexto(i) {
  const c = Number(i.cantidad) || 0;
  if (i.unidad === "kg") return c < 1 ? `${Math.round(c * 1000)} g` : `${String(Math.round(c * 100) / 100).replace(".", ",")} kg`;
  return `${c} un.`;
}

export default function Seguimiento({ params }) {
  const token = params.token;
  const [pedido, setPedido] = useState(undefined); // undefined = cargando, null = no existe
  const [whatsapp, setWhatsapp] = useState(String(process.env.NEXT_PUBLIC_WHATSAPP || "").replace(/\D/g, ""));
  const [fallo, setFallo] = useState(false);

  async function cargar() {
    try {
      const { data, error } = await supabase.rpc("seguimiento_pedido", { t: token });
      if (error) throw error;
      setPedido(data || null);
      setFallo(false);
    } catch (e) {
      setFallo(true);
      setPedido((p) => (p === undefined ? null : p));
    }
  }

  useEffect(() => {
    cargar();
    supabase
      .from("tienda_config")
      .select("whatsapp")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => data?.whatsapp && setWhatsapp(String(data.whatsapp).replace(/\D/g, "")));
    const t = setInterval(() => document.visibilityState === "visible" && cargar(), 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const estado = pedido?.estado;
  const envio = pedido?.entrega === "envio";
  const pasos = [
    { clave: "nuevo", titulo: "Recibimos tu pedido", detalle: "Lo estamos preparando." },
    { clave: "preparado", titulo: envio ? "Listo para enviar" : "Listo para retirar", detalle: envio ? "Enseguida te lo llevamos." : "Ya podés pasar a retirarlo." },
    { clave: "entregado", titulo: "Entregado", detalle: "¡Gracias por elegirnos!" },
  ];
  const actual = estado === "entregado" ? 2 : estado === "preparado" ? 1 : 0;

  return (
    <main className="min-h-screen bg-[var(--fondo)] text-[var(--tinta)]">
      <div className="max-w-md mx-auto px-5 py-8">
        <p className="text-center text-2xl font-extrabold text-[var(--verde)] mb-1">Nuez Co</p>
        <h1 className="text-center text-sm font-semibold text-[var(--tinta-suave)] mb-6">Seguimiento de tu pedido</h1>

        {pedido === undefined && <p className="text-center text-sm text-[var(--tinta-suave)]">Cargando…</p>}

        {pedido === null && (
          <div className="bg-white rounded-2xl border border-[var(--borde)] p-6 text-center">
            <p className="font-semibold">{fallo ? "No pudimos cargar tu pedido ahora." : "No encontramos este pedido."}</p>
            <p className="text-sm text-[var(--tinta-suave)] mt-2">{fallo ? "Revisá tu conexión e intentá de nuevo en un momento." : "Revisá que el enlace esté completo, tal como lo recibiste por WhatsApp."}</p>
          </div>
        )}

        {pedido && (
          <>
            <div className="bg-white rounded-2xl border border-[var(--borde)] p-5">
              <p className="text-sm text-[var(--tinta-suave)]">
                Pedido #{pedido.id}
                {pedido.nombre ? ` · ${pedido.nombre}` : ""}
              </p>

              {estado === "cancelado" ? (
                <p className="mt-3 font-semibold">Este pedido fue cancelado. Si tenés dudas, escribinos por WhatsApp.</p>
              ) : (
                <ol className="mt-4 space-y-4">
                  {pasos.map((p, i) => {
                    const hecho = i < actual || (i === actual && estado === "entregado");
                    const enCurso = i === actual && estado !== "entregado";
                    return (
                      <li key={p.clave} className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                            hecho ? "bg-[var(--verde)] text-white" : enCurso ? "bg-[var(--acento)] text-[var(--sobre-acento)]" : "bg-[var(--fondo-suave)] text-[var(--tinta-suave)]"
                          }`}
                        >
                          {hecho ? "✓" : i + 1}
                        </span>
                        <div className={hecho || enCurso ? "" : "opacity-50"}>
                          <p className={`font-semibold leading-tight ${enCurso ? "text-[var(--verde)]" : ""}`}>{p.titulo}</p>
                          {(enCurso || hecho) && <p className="text-sm text-[var(--tinta-suave)]">{p.detalle}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-[var(--borde)] p-5 mt-4">
              <p className="text-sm font-semibold mb-2">Tu pedido</p>
              <ul className="text-sm space-y-1">
                {(pedido.items || []).map((i, k) => (
                  <li key={k} className="flex justify-between gap-3">
                    <span>{i.nombre}</span>
                    <span className="text-[var(--tinta-suave)] whitespace-nowrap">{cantidadTexto(i)}</span>
                  </li>
                ))}
              </ul>
              <p className="flex justify-between font-bold mt-3 pt-3 border-t border-[var(--borde)]">
                <span>Total</span>
                <span>{money(pedido.total)}</span>
              </p>
              <p className="text-xs text-[var(--tinta-suave)] mt-2">Los precios y el stock se confirman al preparar el pedido.</p>
            </div>

            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola! Consulta por mi pedido #${pedido.id}`)}`}
                className="mt-4 block w-full h-12 leading-[3rem] text-center rounded-xl border border-[var(--borde)] text-sm font-semibold bg-white"
              >
                Consultar por WhatsApp
              </a>
            )}
            <p className="text-center text-xs text-[var(--tinta-suave)] mt-4">Esta página se actualiza sola.</p>
          </>
        )}
      </div>
    </main>
  );
}
