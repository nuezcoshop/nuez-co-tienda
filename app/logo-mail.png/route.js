import { supabase } from "@/lib/supabase";

// Logo de la tienda en PNG para los mails (Gmail y otros no muestran SVG).
// Toma el logo cargado en "Tienda online" y lo convierte; si algo falla, el mail muestra el nombre.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { data } = await supabase.from("tienda_config").select("logo_url").eq("id", 1).maybeSingle();
    const url = (data?.logo_url || "").trim();
    if (!url) return new Response("sin logo", { status: 404 });
    const r = await fetch(url);
    if (!r.ok) return new Response("sin logo", { status: 404 });
    const buf = Buffer.from(await r.arrayBuffer());
    const sharp = (await import("sharp")).default;
    const png = await sharp(buf, { density: 300 }).resize({ height: 160, withoutEnlargement: false }).png().toBuffer();
    return new Response(png, {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    });
  } catch (e) {
    return new Response("error", { status: 404 });
  }
}
