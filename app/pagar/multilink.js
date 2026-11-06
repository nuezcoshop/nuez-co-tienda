"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const esAndroid = () => typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent || "");

function usuarioInstagram(valor) {
  return String(valor || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0];
}

// Android: enlace "intent" que abre la app (Instagram / Google Maps) y, si no está instalada, cae a la web.
function enlaceInstagram(valor) {
  const u = usuarioInstagram(valor);
  if (!u) return "";
  const web = `https://www.instagram.com/${u}/`;
  if (esAndroid()) {
    return `intent://instagram.com/_u/${u}/#Intent;package=com.instagram.android;scheme=https;S.browser_fallback_url=${encodeURIComponent(web)};end`;
  }
  return web; // iPhone: el enlace de Instagram abre la app instalada
}

function enlaceResena(url) {
  const t = String(url || "").trim();
  if (!t) return "";
  if (esAndroid()) {
    try {
      const u = new URL(t);
      if (/(^|\.)google\.[a-z.]+$|goo\.gl$|g\.page$/i.test(u.hostname)) {
        return `intent://${u.hostname}${u.pathname}${u.search}#Intent;package=com.google.android.apps.maps;scheme=https;S.browser_fallback_url=${encodeURIComponent(t)};end`;
      }
    } catch (e) {
      return t;
    }
  }
  return t;
}

function Boton({ href, icono, titulo, sub }) {
  return (
    <a
      href={href}
      className="flex items-center gap-4 w-full rounded-2xl bg-white border border-[var(--borde)] px-5 py-4 shadow-sm active:scale-[0.99]"
    >
      <span className="text-3xl">{icono}</span>
      <span className="flex-1 text-left">
        <span className="block text-base font-bold text-[var(--tinta)]">{titulo}</span>
        {sub && <span className="block text-xs text-[var(--tinta-suave)]">{sub}</span>}
      </span>
      <span className="text-[var(--tinta-suave)]">›</span>
    </a>
  );
}

// Pantalla de "pausa": enlaces del local. Cuando el cajero lanza un cobro, esta pantalla pasa sola a pagar.
export default function Multilink() {
  const [links, setLinks] = useState(null);
  const [android, setAndroid] = useState(false);

  useEffect(() => {
    setAndroid(esAndroid());
    (async () => {
      try {
        const { data } = await supabase.rpc("multilink_publico");
        setLinks(data || {});
      } catch (e) {
        setLinks({});
      }
    })();
  }, []);

  if (!links) return <p className="text-center text-sm text-[var(--tinta-suave)] mt-6">Cargando…</p>;

  const ig = enlaceInstagram(links.instagram);
  const resena = enlaceResena(links.resena_url);
  const tienda = links.tienda_url || "https://nuezco.com.ar";

  return (
    <div className="mt-4 space-y-3" data-android={android ? "1" : "0"}>
      <p className="text-center text-base font-semibold text-[var(--tinta)] mb-2">¡Gracias por visitarnos!</p>
      {resena && <Boton href={resena} icono="⭐" titulo="Dejá tu reseña en Google" sub="Nos ayuda muchísimo" />}
      {ig && <Boton href={ig} icono="📸" titulo="Seguinos en Instagram" sub={`@${usuarioInstagram(links.instagram)}`} />}
      <Boton href={tienda} icono="🛒" titulo="Tienda online" sub="Pedí desde tu casa" />
    </div>
  );
}
