import { supabase } from "@/lib/supabase";
import Tienda from "./tienda";

// La página se genera en el servidor y se refresca sola cada 60 segundos:
// carga rápido en el celular y no consulta la base en cada visita.
export const revalidate = 60;

// A partir de un color "#rrggbb" arma el color oscuro (botón apretado) y el claro (fondos suaves).
function coloresDesde(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex || "")) return {};
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const mezcla = (k, base) => "#" + [r, g, b].map((v) => Math.round(v * k + base * (1 - k)).toString(16).padStart(2, "0")).join("");
  return { "--verde": hex, "--verde-oscuro": mezcla(0.78, 0), "--verde-claro": mezcla(0.12, 255) };
}

export default async function Page() {
  const [prod, ban, cfg, catf] = await Promise.all([
    supabase.from("tienda_productos").select("*").order("nombre"),
    supabase.from("tienda_banners").select("id, imagen_url, enlace, titulo, orden").order("orden"),
    // Datos editables desde la pantalla "Tienda online" del sistema. Si todavía no existen,
    // se usan los valores cargados en Vercel como respaldo.
    supabase.from("tienda_config").select("*").eq("id", 1).maybeSingle(),
    supabase.from("tienda_categorias_fotos").select("categoria, url"),
  ]);
  const c = cfg.data || {};

  const config = {
    nombre: c.nombre || process.env.NEXT_PUBLIC_NOMBRE_TIENDA || "Nuez Co",
    whatsapp: String(c.whatsapp || process.env.NEXT_PUBLIC_WHATSAPP || "").replace(/\D/g, ""),
    direccion: c.direccion || process.env.NEXT_PUBLIC_DIRECCION_SUCURSAL || "",
    horario: c.horario || process.env.NEXT_PUBLIC_HORARIO || "",
    envioGratisDesde:
      c.envio_gratis_desde !== null && c.envio_gratis_desde !== undefined
        ? Number(c.envio_gratis_desde) || 0
        : Number(process.env.NEXT_PUBLIC_ENVIO_GRATIS_DESDE) || 0,
    bienvenida: c.bienvenida || "",
    logo: c.logo_url || "",
  };

  // Color principal elegido en el sistema (si no hay, queda el verde de siempre).
  const colores = coloresDesde(c.color_principal);
  const fotosCategorias = {};
  (catf.data || []).forEach((f) => (fotosCategorias[f.categoria] = f.url));

  return (
    <div style={colores}>
      <Tienda productos={prod.data || []} banners={ban.data || []} config={config} fotosCategorias={fotosCategorias} hayError={!!prod.error} />
    </div>
  );
}
