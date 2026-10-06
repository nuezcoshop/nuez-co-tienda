import { supabase } from "@/lib/supabase";
import Tienda from "./tienda";

// La página se genera en el servidor y se refresca sola cada 60 segundos:
// carga rápido en el celular y no consulta la base en cada visita.
export const revalidate = 60;

export default async function Page() {
  const [prod, ban] = await Promise.all([
    supabase.from("tienda_productos").select("*").order("nombre"),
    supabase.from("tienda_banners").select("id, imagen_url, enlace, titulo, orden").order("orden"),
  ]);

  const config = {
    nombre: process.env.NEXT_PUBLIC_NOMBRE_TIENDA || "Nuez Co",
    whatsapp: (process.env.NEXT_PUBLIC_WHATSAPP || "").replace(/\D/g, ""),
    direccion: process.env.NEXT_PUBLIC_DIRECCION_SUCURSAL || "",
    horario: process.env.NEXT_PUBLIC_HORARIO || "",
    envioGratisDesde: Number(process.env.NEXT_PUBLIC_ENVIO_GRATIS_DESDE) || 0,
  };

  return <Tienda productos={prod.data || []} banners={ban.data || []} config={config} hayError={!!prod.error} />;
}
