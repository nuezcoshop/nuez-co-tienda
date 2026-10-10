import { Montserrat } from "next/font/google";
import "./globals.css";
import { supabase } from "@/lib/supabase";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const nombre = process.env.NEXT_PUBLIC_NOMBRE_TIENDA || "Nuez Co";

// Se refresca solo cada 60 segundos, igual que la tienda.
export const revalidate = 60;

const TITULO = nombre + " | Productos naturales";
const DESCRIPCION = "Frutos secos, semillas y productos naturales. Armá tu pedido y cerralo por WhatsApp.";

// Título, descripción e imagen del link: se editan desde "Tienda online" en el POS.
// Si no hay nada cargado (o falla la lectura), se usan los textos de siempre.
export async function generateMetadata() {
  let c = {};
  try {
    const { data } = await supabase.from("tienda_config").select("*").eq("id", 1).maybeSingle();
    c = data || {};
  } catch (e) {
    c = {};
  }
  const titulo = (c.seo_titulo || "").trim() || TITULO;
  const descripcion = (c.seo_descripcion || "").trim() || DESCRIPCION;
  const imagen = (c.seo_imagen || "").trim();
  return {
    title: titulo,
    description: descripcion,
    openGraph: {
      title: titulo,
      description: descripcion,
      type: "website",
      locale: "es_AR",
      siteName: c.nombre || nombre,
      ...(imagen ? { images: [{ url: imagen, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: imagen ? "summary_large_image" : "summary",
      title: titulo,
      description: descripcion,
      ...(imagen ? { images: [imagen] } : {}),
    },
  };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2f7a55",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={montserrat.className}>{children}</body>
    </html>
  );
}
