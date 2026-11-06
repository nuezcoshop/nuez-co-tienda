// Esta página (multilink y pago del mostrador) no debe aparecer en buscadores.
export const metadata = {
  title: "Nuez Co",
  robots: { index: false, follow: false },
};

export default function Layout({ children }) {
  return children;
}
