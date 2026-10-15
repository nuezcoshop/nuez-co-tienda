// El seguimiento es privado: no debe aparecer en buscadores.
export const metadata = {
  title: "Seguimiento de tu pedido | Nuez Co",
  robots: { index: false, follow: false },
};

export default function Layout({ children }) {
  return children;
}
