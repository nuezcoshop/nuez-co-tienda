import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const nombre = process.env.NEXT_PUBLIC_NOMBRE_TIENDA || "Nuez Co";

export const metadata = {
  title: nombre + " | Productos naturales",
  description: "Frutos secos, semillas y productos naturales. Armá tu pedido y cerralo por WhatsApp.",
};

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
