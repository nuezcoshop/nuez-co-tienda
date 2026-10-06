"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { distanciaKm } from "@/lib/envio";

const icono = (emoji, tam) =>
  L.divIcon({
    html: `<div style="font-size:${tam}px;line-height:${tam}px">${emoji}</div>`,
    className: "",
    iconSize: [tam, tam],
    iconAnchor: [tam / 2, tam],
  });

// Mapa liviano (OpenStreetMap): el cliente toca o arrastra el pin hasta su casa.
export default function MapaEnvio({ sucursal, zonas, inicial, onConfirmar, onCerrar }) {
  const caja = useRef(null);
  const mapa = useRef(null);
  const pin = useRef(null);
  const [pos, setPos] = useState(inicial || null);
  const [aviso, setAviso] = useState("");

  function ponerPin(p, centrar) {
    setPos(p);
    if (!mapa.current) return;
    if (!pin.current) {
      pin.current = L.marker([p.lat, p.lng], { draggable: true, icon: icono("📍", 36) }).addTo(mapa.current);
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
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    if (sucursal) {
      L.marker([sucursal.lat, sucursal.lng], { icon: icono("🏪", 30), interactive: false }).addTo(m);
      (zonas || [])
        .filter((z) => Number(z.km) > 0)
        .forEach((z) => L.circle([sucursal.lat, sucursal.lng], { radius: Number(z.km) * 1000, color: "#2f7a55", weight: 1, fillOpacity: 0.03, dashArray: "4 4", interactive: false }).addTo(m));
    }
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

  function usarMiUbicacion() {
    setAviso("");
    if (!navigator.geolocation) return setAviso("Tu celular no permite ubicarte automáticamente. Tocá el mapa para marcar tu casa.");
    navigator.geolocation.getCurrentPosition(
      (r) => ponerPin({ lat: r.coords.latitude, lng: r.coords.longitude }, true),
      () => setAviso("No pudimos ubicarte. Tocá el mapa para marcar tu casa."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const km = pos && sucursal ? distanciaKm(sucursal, pos) : null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center" onClick={(e) => { e.stopPropagation(); onCerrar(); }}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-lg font-bold text-[var(--verde)]">¿Dónde lo llevamos?</h2>
          <button onClick={onCerrar} className="w-9 h-9 rounded-full bg-[var(--fondo-suave)]" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="px-5 text-xs text-[var(--tinta-suave)] mb-2">Tocá el mapa donde vivís o arrastrá el pin 📍. Podés acercar con dos dedos.</p>
        <div ref={caja} className="relative z-0 w-full h-[46vh] bg-[var(--fondo-suave)]" />
        <div className="p-4">
          {aviso && <p className="text-xs text-red-700 mb-2">{aviso}</p>}
          <div className="flex gap-2">
            <button onClick={usarMiUbicacion} className="h-12 px-4 rounded-xl border border-[var(--borde)] text-sm font-semibold">
              Usar mi ubicación
            </button>
            <button
              disabled={!pos}
              onClick={() => onConfirmar(pos)}
              className="flex-1 h-12 rounded-xl bg-[var(--verde)] text-white font-bold disabled:opacity-40"
            >
              {pos ? (km !== null ? `Confirmar (a ${km.toFixed(1).replace(".", ",")} km)` : "Confirmar ubicación") : "Marcá tu ubicación"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
