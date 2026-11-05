// La página de pago no debe aparecer en buscadores.
export const metadata = {
  title: "Pagar | Nuez Co",
  robots: { index: false, follow: false },
};

export default function Layout({ children }) {
  return children;
}
