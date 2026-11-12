"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import QRCode from "qrcode";

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

const escWifi = (t) => String(t || "").replace(/([\\;,:"])/g, "\\$1");

// WiFi: una página web no puede conectar el celular sola; el QR estándar sí lo hace con un toque desde la cámara.
function WifiPanel({ nombre, clave, seguridad, onClose }) {
  const [qr, setQr] = useState("");
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    const texto = `WIFI:T:${seguridad === "nopass" ? "nopass" : seguridad || "WPA"};S:${escWifi(nombre)};${seguridad === "nopass" ? "" : `P:${escWifi(clave)};`};`;
    QRCode.toDataURL(texto, { width: 520, margin: 2 }).then(setQr).catch(() => {});
  }, [nombre, clave, seguridad]);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(clave);
      setCopiado(true);
    } catch (e) {
      window.prompt("Copiá la clave:", clave);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-lg font-bold text-[var(--tinta)]">📶 WiFi para clientes</p>
        <p className="mt-1 text-sm text-[var(--tinta-suave)]">Red: <b className="text-[var(--tinta)]">{nombre}</b></p>
        {qr && <img src={qr} alt="QR del WiFi" className="mx-auto my-3 w-56 h-56" />}
        <p className="text-xs text-[var(--tinta-suave)] mb-3">Abrí la cámara de otro celular y escaneá este QR: te conecta con un toque.</p>
        {seguridad !== "nopass" && clave && (
          <>
            <p className="text-sm text-[var(--tinta-suave)]">Clave: <b className="text-[var(--tinta)] select-all">{clave}</b></p>
            <button onClick={copiar} className="mt-3 w-full rounded-2xl bg-[var(--tinta)] py-3 text-white font-bold">
              {copiado ? "✓ Clave copiada" : "Copiar clave"}
            </button>
            <p className="mt-2 text-xs text-[var(--tinta-suave)]">Después andá a Ajustes → WiFi, elegí «{nombre}» y pegá la clave.</p>
          </>
        )}
        <button onClick={onClose} className="mt-3 text-sm underline text-[var(--tinta-suave)]">Cerrar</button>
      </div>
    </div>
  );
}

// Pantalla de "pausa": enlaces del local. Cuando el cajero lanza un cobro, esta pantalla pasa sola a pagar.
export default function Multilink({ saludo = true, alCargar }) {
  const [links, setLinks] = useState(null);
  const [android, setAndroid] = useState(false);
  const [verWifi, setVerWifi] = useState(false);

  useEffect(() => {
    setAndroid(esAndroid());
    (async () => {
      try {
        const { data } = await supabase.rpc("multilink_publico");
        setLinks(data || {});
        if (alCargar) alCargar(data || {});
      } catch (e) {
        setLinks({});
      }
    })();
  }, []);

  if (!links) return <p className="text-center text-sm text-[var(--tinta-suave)] mt-6">Cargando…</p>;

  const ig = enlaceInstagram(links.instagram);
  const resena = enlaceResena(links.resena_url);
  const tienda = links.tienda_url || "https://nuezco.com.ar";
  const numeroWa = String(links.whatsapp || "").replace(/\D/g, "");
  const wa = numeroWa ? `https://wa.me/${numeroWa}?text=${encodeURIComponent("¡Hola Nuez Co! Los agendo 💛")}` : "";

  return (
    <div className="mt-4 space-y-3" data-android={android ? "1" : "0"}>
      {saludo && <p className="text-center text-base font-semibold text-[var(--tinta)] mb-2">¡Gracias por visitarnos!</p>}
      {resena && <Boton href={resena} icono="⭐" titulo="Dejá tu reseña en Google" sub="Nos ayuda muchísimo" />}
      {ig && <Boton href={ig} icono="📸" titulo="Seguinos en Instagram" sub={`@${usuarioInstagram(links.instagram)}`} />}
      <Boton href={tienda} icono="🛒" titulo="Tienda online" sub="Pedí desde tu casa" />
      {links.wifi_nombre && (
        <button
          type="button"
          onClick={() => setVerWifi(true)}
          className="flex items-center gap-4 w-full rounded-2xl bg-white border border-[var(--borde)] px-5 py-4 shadow-sm active:scale-[0.99]"
        >
          <span className="text-3xl">📶</span>
          <span className="flex-1 text-left">
            <span className="block text-base font-bold text-[var(--tinta)]">Conectate al WiFi</span>
            <span className="block text-xs text-[var(--tinta-suave)]">Escaneá el QR y listo</span>
          </span>
          <span className="text-[var(--tinta-suave)]">›</span>
        </button>
      )}
      {verWifi && <WifiPanel nombre={links.wifi_nombre} clave={links.wifi_clave} seguridad={links.wifi_seguridad} onClose={() => setVerWifi(false)} />}
      {wa && <Boton href={wa} icono="💬" titulo="Agendanos en WhatsApp" sub="Escribinos y enterate de las novedades" />}
    </div>
  );
}
