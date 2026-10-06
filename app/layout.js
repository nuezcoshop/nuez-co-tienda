import "./globals.css";

const nombre = process.env.NEXT_PUBLIC_NOMBRE_TIENDA || "Nuez Co";

export const metadata = {
  title: nombre + " | Productos naturales",
  description: "Frutos secos, semillas y productos naturales. Armá tu pedido y cerralo por WhatsApp.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf6ef",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
