"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabase";
import { distanciaKm } from "@/lib/envio";

const PIN_CASA = L.divIcon({
  html: '<svg width="30" height="40" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))"><path d="M17 0C7.6 0 0 7.4 0 16.6 0 29 17 44 17 44s17-15 17-27.4C34 7.4 26.4 0 17 0z" fill="#2a7de1"/><circle cx="17" cy="16.5" r="6.5" fill="#fff"/></svg>',
  className: "",
  iconSize: [30, 40],
  iconAnchor: [15, 40],
});
const MOTO = L.divIcon({
  html: '<div style="font-size:30px;line-height:30px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))">🛵</div>',
  className: "",
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

// Mapa en vivo del reparto. Solo se muestra mientras el repartidor está compartiendo su ubicación;
// si no hay nada compartido, no aparece. La ubicación se borra apenas se entrega el pedido.
export default function RepartoVivo({ token }) {
  const caja = useRef(null);
  const mapa = useRef(null);
  const moto = useRef(null);
  const casa = useRef(null);
  const ajustado = useRef(false);
  const [dato, setDato] = useState(null); // { activa, lat, lng, hace_seg, dest_lat, dest_lng }

  async function consultar() {
    try {
      const { data } = await supabase.rpc("entrega_vivo_ver", { t: token });
      setDato(data && data.activa ? data : null);
    } catch (e) {
      // se reintenta en el próximo ciclo
    }
  }
  useEffect(() => {
    consultar();
    const t = setInterval(() => document.visibilityState === "visible" && consultar(), 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dato || !caja.current) return;
    if (!mapa.current) {
      const m = L.map(caja.current, { zoomControl: true, attributionControl: true }).setView([dato.lat, dato.lng], 15);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      mapa.current = m;
      setTimeout(() => m.invalidateSize(), 150);
    }
    const m = mapa.current;
    if (!moto.current) moto.current = L.marker([dato.lat, dato.lng], { icon: MOTO }).addTo(m);
    else moto.current.setLatLng([dato.lat, dato.lng]);
    const hayDestino = dato.dest_lat !== null && dato.dest_lat !== undefined && dato.dest_lng !== null && dato.dest_lng !== undefined;
    if (hayDestino) {
      if (!casa.current) casa.current = L.marker([dato.dest_lat, dato.dest_lng], { icon: PIN_CASA }).addTo(m);
      if (!ajustado.current) {
        m.fitBounds(L.latLngBounds([dato.lat, dato.lng], [dato.dest_lat, dato.dest_lng]), { padding: [40, 40], maxZoom: 16 });
        ajustado.current = true;
      }
    } else if (!ajustado.current) {
      m.setView([dato.lat, dato.lng], 16);
      ajustado.current = true;
    }
  }, [dato]);

  useEffect(
    () => () => {
      if (mapa.current) {
        mapa.current.remove();
        mapa.current = null;
        moto.current = null;
        casa.current = null;
        ajustado.current = false;
      }
    },
    []
  );

  if (!dato) return null;
  const km = dato.dest_lat !== null && dato.dest_lat !== undefined ? distanciaKm({ lat: dato.lat, lng: dato.lng }, { lat: dato.dest_lat, lng: dato.dest_lng }) : null;
  const sinSenal = dato.hace_seg > 90;

  return (
    <div className="bg-white rounded-2xl border border-[var(--borde)] p-5 mt-4">
      <p className="font-semibold">🛵 Tu pedido está en camino</p>
      <p className="text-sm text-[var(--tinta-suave)] mt-0.5">
        {km !== null ? (km < 0.15 ? "Está llegando." : `Está a ${km.toFixed(1).replace(".", ",")} km de tu casa (en línea recta).`) : "Seguilo en el mapa."}
        {sinSenal ? " Perdimos la señal un momento, enseguida se actualiza." : ""}
      </p>
      <div ref={caja} className="w-full h-64 rounded-xl overflow-hidden mt-3 border border-[var(--borde)] bg-[var(--fondo-suave)]" />
    </div>
  );
}
