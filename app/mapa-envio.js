"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const icono = (emoji, tam) =>
  L.divIcon({
    html: `<div style="font-size:${tam}px;line-height:${tam}px">${emoji}</div>`,
    className: "",
    iconSize: [tam, tam],
    iconAnchor: [tam / 2, tam],
  });

// Mapa liviano (OpenStreetMap): el cliente toca o arrastra el pin hasta su casa.
// Pin azul moderno (SVG), arrastrable
const PIN_AZUL = L.divIcon({
  html: '<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))"><path d="M17 0C7.6 0 0 7.4 0 16.6 0 29 17 44 17 44s17-15 17-27.4C34 7.4 26.4 0 17 0z" fill="#2a7de1"/><circle cx="17" cy="16.5" r="6.5" fill="#fff"/></svg>',
  className: "",
  iconSize: [34, 44],
  iconAnchor: [17, 44],
});

// Búsqueda de direcciones gratuita (OpenStreetMap). Photon sugiere mientras se escribe; si no encuentra nada,
// "Buscar" prueba con Nominatim. Se limita a la zona de la sucursal para no mostrar resultados de otras ciudades.
async function buscarDirecciones(texto, centro, usarNominatim) {
  const c = centro || { lat: -33.1307, lng: -64.3499 };
  const d = 0.25; // ~25 km alrededor de la sucursal
  const q = /r[ií]o\s*cuarto/i.test(texto) ? texto : texto + ", Río Cuarto";
  if (!usarNominatim) {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lat=${c.lat}&lon=${c.lng}&bbox=${c.lng - d},${c.lat - d},${c.lng + d},${c.lat + d}`;
    const ctl = new AbortController();
    const corte = setTimeout(() => ctl.abort(), 4000);
    let r;
    try {
      r = await fetch(url, { signal: ctl.signal });
    } finally {
      clearTimeout(corte);
    }
    if (!r.ok) throw new Error("photon");
    const j = await r.json();
    return (j.features || [])
      .map((f) => {
        const p = f.properties || {};
        const calle = p.street || p.name || "";
        const titulo = p.housenumber ? `${calle} ${p.housenumber}` : calle;
        const resto = [p.district || p.suburb, p.city || p.town || p.village].filter(Boolean).join(", ");
        const [lng, lat] = f.geometry?.coordinates || [];
        return titulo && isFinite(lat) && isFinite(lng) ? { titulo, resto, lat, lng } : null;
      })
      .filter(Boolean);
  }
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=ar&bounded=1&viewbox=${c.lng - d},${c.lat + d},${c.lng + d},${c.lat - d}&q=${encodeURIComponent(q)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("nominatim");
  const j = await r.json();
  return (j || [])
    .map((x) => {
      const a = x.address || {};
      const calle = a.road || x.name || "";
      const titulo = a.house_number ? `${calle} ${a.house_number}` : calle;
      const resto = [a.suburb || a.neighbourhood, a.city || a.town || a.village].filter(Boolean).join(", ");
      return titulo && isFinite(Number(x.lat)) ? { titulo, resto, lat: Number(x.lat), lng: Number(x.lon) } : null;
    })
    .filter(Boolean);
}

export default function MapaEnvio({ sucursal, zonas, inicial, direccion, onConfirmar, onCerrar }) {
  const caja = useRef(null);
  const mapa = useRef(null);
  const pin = useRef(null);
  const [pos, setPos] = useState(inicial || null);
  const [aviso, setAviso] = useState("");
  const [texto, setTexto] = useState(inicial ? "" : direccion || "");
  const [sugerencias, setSugerencias] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [sinResultados, setSinResultados] = useState(false);
  const [elegida, setElegida] = useState(false);
  const seq = useRef(0);
  const primera = useRef(true);

  function ponerPin(p, centrar) {
    setPos(p);
    if (!mapa.current) return;
    if (!pin.current) {
      pin.current = L.marker([p.lat, p.lng], { draggable: true, icon: PIN_AZUL }).addTo(mapa.current);
      pin.current.on("dragend", () => {
        const ll = pin.current.getLatLng();
        setPos({ lat: ll.lat, lng: ll.lng });
      });
    } else {
      pin.current.setLatLng([p.lat, p.lng]);
    }
    if (centrar) mapa.current.setView([p.lat, p.lng], Math.max(mapa.current.getZoom(), 15));
  }

  useEffect(() => {
    const centro = inicial || sucursal || { lat: -33.1307, lng: -64.3499 };
    const m = L.map(caja.current, { zoomControl: true, attributionControl: true }).setView([centro.lat, centro.lng], inicial ? 16 : 14);
    mapa.current = m;
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(m);
    m.on("click", (e) => ponerPin({ lat: e.latlng.lat, lng: e.latlng.lng }, false));
    if (inicial) ponerPin(inicial, false);
    setTimeout(() => m.invalidateSize(), 150);
    return () => {
      m.remove();
      mapa.current = null;
      pin.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buscar(t, usarNominatim, autoPin) {
    const limpio = String(t || "").trim();
    if (limpio.length < 4) {
      setSugerencias([]);
      setSinResultados(false);
      return;
    }
    const mi = ++seq.current;
    setBuscando(true);
    setAviso("");
    try {
      let res = [];
      if (!usarNominatim) res = await buscarDirecciones(limpio, sucursal, false).catch(() => []);
      // Si el buscador rápido no encuentra nada o tarda, probamos con el otro automáticamente.
      if (res.length === 0) res = await buscarDirecciones(limpio, sucursal, true);
      if (mi !== seq.current) return;
      setBuscando(false);
      setSugerencias(res);
      setSinResultados(res.length === 0);
      if (autoPin && res.length > 0) elegir(res[0], false);
    } catch {
      if (mi !== seq.current) return;
      setSugerencias([]);
      setBuscando(false);
      setAviso("No pudimos buscar la dirección ahora. Tocá el mapa para marcar tu casa.");
    }
  }

  function elegir(r, cerrarLista = true) {
    ponerPin({ lat: r.lat, lng: r.lng }, true);
    if (mapa.current) mapa.current.setView([r.lat, r.lng], 17);
    setElegida(true);
    setTexto(r.resto ? `${r.titulo}, ${r.resto}` : r.titulo);
    if (cerrarLista) setSugerencias([]);
  }

  // Sugerencias mientras se escribe (con una pequeña espera para no saturar el servicio gratuito)
  useEffect(() => {
    if (elegida) return;
    // La primera vez, si ya había una dirección escrita, la busca la otra búsqueda automática (con pin).
    if (primera.current) {
      primera.current = false;
      if (!inicial && direccion && direccion.trim().length >= 4) return;
    }
    const t = setTimeout(() => buscar(texto, false, false), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  // Si el cliente ya había escrito su dirección en el pedido, la buscamos sola al abrir el mapa.
  useEffect(() => {
    if (!inicial && direccion && direccion.trim().length >= 4) {
      const t = setTimeout(() => buscar(direccion, false, true), 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function usarMiUbicacion() {
    setAviso("");
    if (!navigator.geolocation) return setAviso("Tu celular no permite ubicarte automáticamente. Tocá el mapa para marcar tu casa.");
    navigator.geolocation.getCurrentPosition(
      (r) => ponerPin({ lat: r.coords.latitude, lng: r.coords.longitude }, true),
      () => setAviso("No pudimos ubicarte. Tocá el mapa para marcar tu casa."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }


  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center" onClick={(e) => { e.stopPropagation(); onCerrar(); }}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-lg font-bold text-[var(--verde)]">¿Dónde lo llevamos?</h2>
          <button onClick={onCerrar} className="w-9 h-9 rounded-full bg-[var(--fondo-suave)]" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="px-5 mb-2 relative">
          <div className="flex gap-2">
            <input
              value={texto}
              onChange={(e) => {
                setElegida(false);
                setTexto(e.target.value);
              }}
              onKeyDown={(e) => e.key === "Enter" && buscar(texto, true, false)}
              placeholder="Escribí tu dirección (calle y número)"
              className="flex-1 min-w-0 h-11 px-3 rounded-xl border border-[var(--borde)] bg-white text-sm outline-none"
              autoComplete="off"
            />
            <button onClick={() => buscar(texto, true, false)} className="h-11 px-4 rounded-xl bg-[var(--verde)] text-white text-sm font-semibold">
              Buscar
            </button>
          </div>
          {sugerencias.length > 0 && !elegida && (
            <div className="absolute left-5 right-5 top-12 z-10 bg-white border border-[var(--borde)] rounded-xl shadow-lg overflow-hidden">
              {sugerencias.map((r, i) => (
                <button key={i} onClick={() => elegir(r)} className="w-full text-left px-3 py-2.5 border-b border-[var(--borde)] last:border-0 hover:bg-[var(--fondo-suave)]">
                  <span className="block text-sm font-semibold leading-tight">{r.titulo}</span>
                  {r.resto && <span className="block text-xs text-[var(--tinta-suave)]">{r.resto}</span>}
                </button>
              ))}
            </div>
          )}
          {buscando && !elegida && sugerencias.length === 0 && <p className="text-xs text-[var(--tinta-suave)] mt-1">Buscando…</p>}
          {sinResultados && !elegida && !buscando && texto.trim().length >= 4 && (
            <p className="text-xs text-[var(--tinta-suave)] mt-1">No encontramos esa dirección. Probá con otro formato o tocá el mapa donde vivís.</p>
          )}
        </div>
        <p className="px-5 text-xs text-[var(--tinta-suave)] mb-2">
          {elegida && pos ? "¿Es acá donde vivís? Si no, arrastrá el pin o tocá el mapa en el lugar exacto." : "Tocá el mapa donde vivís o arrastrá el pin 📍. Podés acercar con dos dedos."}
        </p>
        <div ref={caja} className="relative z-0 w-full h-[46vh] bg-[var(--fondo-suave)]" />
        <div className="p-4">
          {aviso && <p className="text-xs text-red-700 mb-2">{aviso}</p>}
          <div className="flex gap-2">
            <button onClick={usarMiUbicacion} className="h-12 px-4 rounded-xl border border-[var(--borde)] text-sm font-semibold">
              Usar mi ubicación
            </button>
            <button
              disabled={!pos}
              onClick={() => onConfirmar(pos, elegida ? texto : "")}
              className="flex-1 h-12 rounded-xl bg-[var(--verde)] text-white font-bold disabled:opacity-40"
            >
              {pos ? "Confirmar ubicación" : "Marcá tu ubicación"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
