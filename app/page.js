import { supabase } from "@/lib/supabase";
import Tienda from "./tienda";

// La página se genera en el servidor y se refresca sola cada 60 segundos:
// carga rápido en el celular y no consulta la base en cada visita.
export const revalidate = 60;

export default async function Page() {
  const [prod, ban, cfg] = await Promise.all([
    supabase.from("tienda_productos").select("*").order("nombre"),
    supabase.from("tienda_banners").select("id, imagen_url, enlace, titulo, orden").order("orden"),
    // Datos editables desde la pantalla "Tienda online" del sistema. Si todavía no existen,
    // se usan los valores cargados en Vercel como respaldo.
    supabase.from("tienda_config").select("*").eq("id", 1).maybeSingle(),
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
  };

  return <Tienda productos={prod.data || []} banners={ban.data || []} config={config} hayError={!!prod.error} />;
}
