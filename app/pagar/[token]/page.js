"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { coloresDesde } from "@/lib/colores";

const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");

export default function Pagar({ params }) {
  const token = params.token;
  const [cobro, setCobro] = useState(undefined); // undefined = cargando, null = no existe
  const [tema, setTema] = useState(null);
  const [copiado, setCopiado] = useState("");

  async function cargar() {
    try {
      const { data, error } = await supabase.rpc("cobro_publico", { t: token });
      if (error) throw error;
      setCobro(data || null);
    } catch (e) {
      setCobro((c) => (c === undefined ? null : c));
    }
  }

  useEffect(() => {
    cargar();
    (async () => {
      try {
        const { data } = await supabase.from("tienda_config").select("*").eq("id", 1).maybeSingle();
        if (!data) return;
        setTema({ colores: coloresDesde(data.color_principal, data.color_fondo, data.color_acento), logo: data.logo_url || "", nombre: data.nombre || "Nuez Co" });
      } catch (e) {}
    })();
    const t = setInterval(() => document.visibilityState === "visible" && cargar(), 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copiar(texto, que) {
    try {
      await navigator.clipboard.writeText(String(texto));
      setCopiado(que);
      setTimeout(() => setCopiado(""), 1800);
    } catch (e) {
      setCopiado("");
    }
  }

  const estado = cobro?.estado;

  return (
    <main style={tema ? tema.colores : undefined} className="min-h-screen bg-[var(--fondo)] text-[var(--tinta)]">
      <div className="max-w-md mx-auto px-5 py-8">
        <div className="flex justify-center mb-2 min-h-[3.5rem]">
          {tema?.logo ? (
            <img src={tema.logo} alt={tema.nombre} className="h-14 w-auto max-w-[220px] object-contain" />
          ) : (
            <p className="text-2xl font-extrabold text-[var(--verde)]">{tema ? tema.nombre : ""}</p>
          )}
        </div>
        <h1 className="text-center text-sm font-semibold text-[var(--tinta-suave)] mb-6">Pagar por transferencia</h1>

        {cobro === undefined && <p className="text-center text-sm text-[var(--tinta-suave)]">Cargando…</p>}

        {cobro === null && (
          <div className="bg-white rounded-2xl border border-[var(--borde)] p-6 text-center">
            <p className="font-semibold">No encontramos este cobro.</p>
            <p className="text-sm text-[var(--tinta-suave)] mt-2">Pedile al local que te muestre el código de nuevo.</p>
          </div>
        )}

        {cobro && estado === "pagado" && (
          <div className="bg-white rounded-2xl border border-[var(--borde)] p-6 text-center">
            <p className="text-4xl mb-2">✓</p>
            <p className="font-semibold text-lg text-[var(--verde)]">¡Pago recibido!</p>
            <p className="text-sm text-[var(--tinta-suave)] mt-2">Gracias por elegirnos.</p>
          </div>
        )}

        {cobro && (estado === "cancelado" || estado === "vencido") && (
          <div className="bg-white rounded-2xl border border-[var(--borde)] p-6 text-center">
            <p className="font-semibold">{estado === "vencido" ? "Este cobro venció." : "Este cobro fue cancelado."}</p>
            <p className="text-sm text-[var(--tinta-suave)] mt-2">Pedile al local que genere uno nuevo.</p>
          </div>
        )}

        {cobro && estado === "pendiente" && (
          <>
            <div className="bg-white rounded-2xl border border-[var(--borde)] p-5 text-center">
              <p className="text-sm text-[var(--tinta-suave)]">Monto a transferir</p>
              <p className="text-4xl font-extrabold mt-1">{money(cobro.monto)}</p>
              <button
                onClick={() => copiar(Math.round(Number(cobro.monto)), "monto")}
                className="mt-3 h-10 px-4 rounded-xl border border-[var(--borde)] text-sm font-semibold"
              >
                {copiado === "monto" ? "¡Copiado!" : "Copiar monto"}
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-[var(--borde)] p-5 mt-4 text-center">
              <p className="text-sm text-[var(--tinta-suave)]">Alias de la cuenta</p>
              <p className="text-2xl font-bold mt-1 break-all">{cobro.alias}</p>
              {cobro.titular && <p className="text-sm text-[var(--tinta-suave)] mt-1">Titular: {cobro.titular}</p>}
              <button
                onClick={() => copiar(cobro.alias, "alias")}
                className="mt-3 h-10 px-4 rounded-xl bg-[var(--verde)] text-white text-sm font-semibold"
              >
                {copiado === "alias" ? "¡Copiado!" : "Copiar alias"}
              </button>
            </div>

            <ol className="mt-4 text-sm space-y-1.5 text-[var(--tinta-suave)] list-decimal pl-5">
              <li>Abrí tu app de Mercado Pago o de tu banco y elegí “Transferir”.</li>
              <li>Pegá el alias y escribí el monto exacto.</li>
              <li>Confirmá la transferencia y mostrale el comprobante al cajero.</li>
            </ol>
            <p className="text-center text-xs text-[var(--tinta-suave)] mt-4">Esta página se actualiza sola cuando recibimos el pago.</p>
          </>
        )}
      </div>
    </main>
  );
}
