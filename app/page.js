import { supabase } from "@/lib/supabase";
import Tienda from "./tienda";

// La página se genera en el servidor y se refresca sola cada 60 segundos:
// carga rápido en el celular y no consulta la base en cada visita.
export const revalidate = 60;

// A partir de un color "#rrggbb" arma el color oscuro (botón apretado) y el claro (fondos suaves).
const esHex = (h) => /^#[0-9a-fA-F]{6}$/.test(h || "");
function mezclar(hex, k, base) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return "#" + [r, g, b].map((v) => Math.round(v * k + base * (1 - k)).toString(16).padStart(2, "0")).join("");
}
function coloresDesde(hex, fondo) {
  const vars = {};
  if (esHex(hex)) {
    vars["--verde"] = hex;
    vars["--verde-oscuro"] = mezclar(hex, 0.78, 0);
    vars["--verde-claro"] = mezclar(hex, 0.12, 255);
    // Textos en tonos del color principal (en vez de negro/gris) para que todo combine.
    vars["--tinta"] = mezclar(hex, 0.6, 0);
    vars["--tinta-suave"] = mezclar(hex, 0.7, 255);
  }
  if (esHex(fondo)) {
    vars["--fondo"] = fondo;
    vars["--fondo-suave"] = mezclar(fondo, 0.95, 0); // un poquito más oscuro, para buscador y relleno
  }
  return vars;
}

export default async function Page() {
  const [prod, ban, cfg, catf, dest] = await Promise.all([
    supabase.from("tienda_productos").select("*").order("nombre"),
    supabase.from("tienda_banners").select("*").order("orden"),
    // Datos editables desde la pantalla "Tienda online" del sistema. Si todavía no existen,
    // se usan los valores cargados en Vercel como respaldo.
    supabase.from("tienda_config").select("*").eq("id", 1).maybeSingle(),
    supabase.from("tienda_categorias_fotos").select("categoria, url"),
    supabase.from("tienda_destacados").select("producto_id, orden").order("orden"),
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
    sucursal:
      c.sucursal_lat !== null && c.sucursal_lat !== undefined && c.sucursal_lng !== null && c.sucursal_lng !== undefined
        ? { lat: Number(c.sucursal_lat), lng: Number(c.sucursal_lng) }
        : null,
    destacadosTitulo: c.destacados_titulo || "Novedades",
    ubicacionLink: c.ubicacion_link || "",
    zonasEnvio: Array.isArray(c.zonas_envio) ? c.zonas_envio : [],
    nosotros: {
      activo: !!c.nosotros_activo,
      titulo: c.nosotros_titulo || "Nuestra historia",
      subtitulo: c.nosotros_subtitulo || "",
      texto: c.nosotros_texto || "",
      foto: c.nosotros_foto || "",
    },
  };

  // Color principal elegido en el sistema (si no hay, queda el verde de siempre).
  const colores = coloresDesde(c.color_principal, c.color_fondo);
  const fotosCategorias = {};
  (catf.data || []).forEach((f) => (fotosCategorias[f.categoria] = f.url));

  return (
    <div style={colores}>
      {esHex(c.color_fondo) && <style>{`html,body{background:${c.color_fondo}}`}</style>}
      <Tienda
        productos={prod.data || []}
        banners={ban.data || []}
        destacados={(dest.data || []).map((d) => String(d.producto_id))}
        config={config} fotosCategorias={fotosCategorias} hayError={!!prod.error} />
    </div>
  );
}
