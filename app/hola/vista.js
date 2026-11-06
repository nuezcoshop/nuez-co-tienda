"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { coloresDesde } from "@/lib/colores";
import Multilink from "./multilink";
import { descargarTicket } from "./ticket";

const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");

// Pantalla de pago que ve el cliente. `obtener` devuelve el cobro (o null).
// En modo `fijo` (el QR impreso del mostrador) espera a que el local cargue el monto.
export default function VistaPago({ obtener, fijo }) {
  const [cobro, setCobro] = useState(undefined); // undefined = cargando
  const [tema, setTema] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const tokenCobro = useRef(""); // lo recibe la página mientras el cobro está pendiente (para el ticket)
  const [bajandoTicket, setBajandoTicket] = useState(false);
  const [errorTicket, setErrorTicket] = useState("");
  const [infoLocal, setInfoLocal] = useState({});

  async function cargar() {
    try {
      const d = await obtener();
      if (d && d.token) tokenCobro.current = d.token;
      if (!d) tokenCobro.current = "";
      setCobro(d || null);
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
    const t = setInterval(() => document.visibilityState === "visible" && cargar(), 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copiarAlias() {
    try {
      await navigator.clipboard.writeText(String(cobro.alias));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch (e) {
      setCopiado(false);
    }
  }

  const WEB_MP = "https://www.mercadopago.com.ar/";
  // Android: enlace "intent" hacia la app (esquema propio de Mercado Pago). Si no se puede abrir, cae a la web.
  const enlaceAndroid = `intent://home#Intent;scheme=mercadopago;package=com.mercadopago.wallet;S.browser_fallback_url=${encodeURIComponent(WEB_MP)};end`;
  const [esAndroid, setEsAndroid] = useState(false);
  useEffect(() => {
    setEsAndroid(/Android/i.test(navigator.userAgent || ""));
  }, []);

  // iPhone y computadora: el alias se copia y se abre la app (iPhone) o la web.
  function irMercadoPago() {
    copiarAlias();
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua)) {
      const t = setTimeout(() => { if (document.visibilityState === "visible") window.location.href = WEB_MP; }, 1500);
      document.addEventListener("visibilitychange", () => clearTimeout(t), { once: true });
      window.location.href = "mercadopago://";
    } else {
      window.location.href = WEB_MP;
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

        {cobro === undefined && <p className="text-center text-sm text-[var(--tinta-suave)] mt-6">Cargando…</p>}

        {cobro === null && fijo && <Multilink />}

        {cobro === null && !fijo && (
          <div className="bg-white rounded-2xl border border-[var(--borde)] p-6 text-center mt-4">
            <p className="font-semibold">No encontramos este cobro.</p>
            <p className="text-sm text-[var(--tinta-suave)] mt-2">
              Pedile al local que te muestre el código de nuevo.
            </p>
          </div>
        )}

        {cobro && estado === "pagado" && (
          <>
            <div className="bg-white rounded-2xl border border-[var(--borde)] p-6 text-center mt-4">
              <p className="text-5xl mb-2 text-[var(--verde)]">✓</p>
              <p className="font-semibold text-lg text-[var(--verde)]">¡Pago recibido!</p>
              <p className="text-sm text-[var(--tinta-suave)] mt-2">Gracias por elegirnos.</p>
            </div>
            {tokenCobro.current && (
              <div className="mt-3">
                <button
                  onClick={async () => {
                    setBajandoTicket(true);
                    setErrorTicket("");
                    try {
                      await descargarTicket(tokenCobro.current, { ...infoLocal, logo_url: tema?.logo });
                    } catch (e) {
                      setErrorTicket(e.message || "No se pudo descargar el ticket.");
                    }
                    setBajandoTicket(false);
                  }}
                  disabled={!cobro.ticket_listo || bajandoTicket}
                  className="w-full h-14 rounded-2xl bg-[var(--verde)] text-white text-base font-bold disabled:opacity-60"
                >
                  {bajandoTicket ? "Preparando…" : cobro.ticket_listo ? "⬇ DESCARGAR TICKET DE COMPRA" : "Preparando tu ticket…"}
                </button>
                {errorTicket && <p className="text-xs text-center text-red-600 mt-1.5">{errorTicket}</p>}
              </div>
            )}
            <Multilink saludo={false} alCargar={(l) => setInfoLocal(l || {})} />
          </>
        )}

        {cobro && (estado === "cancelado" || estado === "vencido") && (
          <div className="bg-white rounded-2xl border border-[var(--borde)] p-6 text-center mt-4">
            <p className="font-semibold">{estado === "vencido" ? "Este cobro venció." : "Este cobro fue cancelado."}</p>
            <p className="text-sm text-[var(--tinta-suave)] mt-2">Pedile al local que genere uno nuevo.</p>
          </div>
        )}

        {cobro && estado === "pendiente" && (
          <>
            <div className="bg-white rounded-2xl border border-[var(--borde)] p-6 text-center mt-4">
              <p className="text-sm text-[var(--tinta-suave)]">Total a pagar</p>
              <p className="text-5xl font-extrabold mt-1">{money(cobro.monto)}</p>
              <p className="text-sm text-[var(--tinta-suave)] mt-3">
                Transferí a <span className="font-bold text-[var(--tinta)]">{cobro.alias}</span>
                {cobro.titular ? ` · ${cobro.titular}` : ""}
              </p>
            </div>

            {esAndroid ? (
              // En Android es un enlace real: Chrome lo trata como toque del usuario y abre la app.
              <a
                href={enlaceAndroid}
                onClick={copiarAlias}
                className="mt-4 w-full h-14 rounded-2xl bg-[var(--verde)] text-white text-base font-bold flex items-center justify-center"
              >
                Pagar con Mercado Pago
              </a>
            ) : (
              <button onClick={irMercadoPago} className="mt-4 w-full h-14 rounded-2xl bg-[var(--verde)] text-white text-base font-bold">
                Pagar con Mercado Pago
              </button>
            )}
            <p className="text-xs text-center text-[var(--tinta-suave)] mt-1.5">Copiamos el alias por vos y abrimos la app: pegalo y escribí el monto.</p>

            <button onClick={copiarAlias} className="mt-4 w-full h-12 rounded-2xl border border-[var(--borde)] bg-white text-sm font-semibold">
              {copiado ? "¡Alias copiado!" : "Otro banco o billetera: copiar alias"}
            </button>
            <p className="text-center text-xs text-[var(--tinta-suave)] mt-4">Esta página se actualiza sola cuando recibimos el pago.</p>
          </>
        )}
      </div>
    </main>
  );
}
