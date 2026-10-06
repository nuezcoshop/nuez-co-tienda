// Cálculo de envío por distancia en línea recta desde la sucursal.

export function distanciaKm(a, b) {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// zonas: [{ km: 2, precio: 1500 }, { km: 5, precio: 2500 }]. Devuelve { km, precio, fuera }.
export function costoEnvio(zonas, sucursal, punto) {
  if (!sucursal || !punto) return null;
  const lista = (zonas || [])
    .map((z) => ({ km: Number(z.km), precio: Number(z.precio) }))
    .filter((z) => z.km > 0 && z.precio >= 0)
    .sort((a, b) => a.km - b.km);
  if (lista.length === 0) return null;
  const km = distanciaKm(sucursal, punto);
  const zona = lista.find((z) => km <= z.km + 1e-9);
  return zona ? { km, precio: zona.precio, fuera: false } : { km, precio: 0, fuera: true };
}

export const enlaceMapa = (p) => `https://www.google.com/maps?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
