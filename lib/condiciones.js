// Clasificaciones rápidas de producto (se tildan en el producto y la tienda las usa como filtro y como logo o texto).
// "alto" = alto relativo del logo para que los círculos se vean del mismo tamaño. Sin logo = se muestra en texto.
export const CONDICIONES = [
  { id: "gluten", nombre: "Sin gluten", detalle: "Sin gluten (sello TACC)", logo: "/condiciones/sin-gluten.png", mascara: "/condiciones/sin-gluten-mask.png", alto: 1.105 },
  { id: "vegano", nombre: "Vegano", detalle: "Vegano", logo: "/condiciones/vegano.png", mascara: "/condiciones/vegano-mask.png", alto: 1 },
  { id: "azucar", nombre: "Sin azúcar agregado", detalle: "Sin azúcar agregado", logo: null, alto: 1 },
];
