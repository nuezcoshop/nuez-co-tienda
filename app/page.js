import { supabase } from "@/lib/supabase";
import { coloresDesde, esHex } from "@/lib/colores";
import { tipografiaDesde, hrefFuentes } from "@/lib/tipografia";
import { limpiarEscalones } from "./escalones";
import Tienda from "./tienda";
import Popup from "./popup";
import Visitas from "./visitas";

// La página se genera en el servidor y se refresca sola cada 60 segundos:
// carga rápido en el celular y no consulta la base en cada visita.
export const revalidate = 15;

const enlacePopup = (l) => {
  const t = String(l || "").trim();
  return !t ? "" : /^https?:\/\//i.test(t) ? t : "https://" + t;
};

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
    escalones: limpiarEscalones(c.escalones, c.envio_gratis_desde !== null && c.envio_gratis_desde !== undefined ? Number(c.envio_gratis_desde) || 0 : Number(process.env.NEXT_PUBLIC_ENVIO_GRATIS_DESDE) || 0),
    bienvenida: c.bienvenida || "",
    instagram: c.instagram || "",
    bolsa: { activa: !!c.bolsa_activa, productoId: c.bolsa_producto_id ? String(c.bolsa_producto_id) : "", foto: c.bolsa_foto || "" },
    cintaVelocidad: Math.min(10, Math.max(1, Math.round(Number(c.cinta_velocidad) || 4))),
    cinta: String(c.cinta_texto || "").split(/\r?\n/).map((t) => t.trim()).filter(Boolean).slice(0, 6),
    logo: c.logo_url || "",
    sucursal:
      c.sucursal_lat !== null && c.sucursal_lat !== undefined && c.sucursal_lng !== null && c.sucursal_lng !== undefined
        ? { lat: Number(c.sucursal_lat), lng: Number(c.sucursal_lng) }
        : null,
    destacadosTitulo: c.destacados_titulo || "Novedades",
    ubicacionLink: c.ubicacion_link || "",
    zonasEnvio: Array.isArray(c.zonas_envio) ? c.zonas_envio : [],
    categoriasOrden: Array.isArray(c.categorias_orden) ? c.categorias_orden.map(String) : [],
    nosotros: {
      activo: !!c.nosotros_activo,
      titulo: c.nosotros_titulo || "Nuestra historia",
      subtitulo: c.nosotros_subtitulo || "",
      texto: c.nosotros_texto || "",
      foto: c.nosotros_foto || "",
    },
  };

  // Color principal elegido en el sistema (si no hay, queda el verde de siempre).
  const colores = coloresDesde(c.color_principal, c.color_fondo, c.color_acento);
  // Tipografía, tamaños y colores de texto (si no se eligió nada, no se agrega nada).
  const tipo = tipografiaDesde(c);
  const hrefTipo = hrefFuentes(c);
  const estilosTipo = (
    <>
      {hrefTipo && (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link rel="stylesheet" href={hrefTipo} />
        </>
      )}
      {tipo.css && <style>{tipo.css}</style>}
    </>
  );
  const fotosCategorias = {};
  (catf.data || []).forEach((f) => (fotosCategorias[f.categoria] = f.url));

  // Tienda en pausa: se muestra solo el mensaje elegido en el sistema.
  if (c.pausa_activa) {
    return (
      <div className="nz-tema" style={{ ...colores, ...tipo.vars, color: "var(--tinta)" }}>
      {estilosTipo}
        {esHex(c.color_fondo) && <style>{`html,body{background:${c.color_fondo}}`}</style>}
        <main className="min-h-screen flex flex-col items-center justify-center text-center px-6" style={{ background: "var(--fondo, #fff)" }}>
          {config.logo && <img src={config.logo} alt={config.nombre} className="h-20 w-auto mb-6 object-contain" />}
          <h1 className="text-2xl font-extrabold mb-3" style={{ color: "var(--verde, #2f7a55)" }}>{config.nombre}</h1>
          <p className="max-w-md text-base font-semibold whitespace-pre-line">
            {String(c.pausa_mensaje || "").trim() || "Tienda deshabilitada temporalmente. Volvemos en unos minutos."}
          </p>
        </main>
      </div>
    );
  }

  // Pop up: activo y, si hay fecha límite, hasta el final de ese día (hora de Argentina).
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const popupVigente = !!c.popup_activo && !!String(c.popup_titulo || "").trim() && (!c.popup_hasta || String(c.popup_hasta).slice(0, 10) >= hoy);

  return (
    <div className="nz-tema" style={{ ...colores, ...tipo.vars, color: "var(--tinta)" }}>
      {estilosTipo}
      <Visitas />
      {popupVigente && (
        <Popup titulo={String(c.popup_titulo).trim()} boton={String(c.popup_boton || "").trim()} link={enlacePopup(c.popup_link)} letraChica={String(c.popup_letra_chica || "").trim()} />
      )}
      {esHex(c.color_fondo) && <style>{`html,body{background:${c.color_fondo}}`}</style>}
      <Tienda
        productos={prod.data || []}
        banners={ban.data || []}
        destacados={(dest.data || []).map((d) => String(d.producto_id))}
        config={config} fotosCategorias={fotosCategorias} hayError={!!prod.error} />
    </div>
  );
}
