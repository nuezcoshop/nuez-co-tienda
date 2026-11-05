// La página de pago es privada de cada cobro: no debe aparecer en buscadores.
export const metadata = {
  title: "Pagar | Nuez Co",
  robots: { index: false, follow: false },
};

export default function Layout({ children }) {
  return children;
}
