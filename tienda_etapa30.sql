-- Promociones por cantidad en productos por unidad: "lleva N, paga M" (2x1, 3x2, etc.).
alter table public.productos add column if not exists promo_lleva integer, add column if not exists promo_paga integer;

create or replace view public.tienda_productos as
 SELECT p.id,
    p.nombre,
    p.unidad,
    p.precio_venta,
    COALESCE(tf.url, p.foto_url) AS foto_url,
    c.nombre AS categoria,
        CASE
            WHEN p.es_combo THEN stock_combo(p.id)
            ELSE COALESCE(( SELECT sum(s.cantidad) AS sum
               FROM stock s
              WHERE s.producto_id = p.id), 0::numeric)
        END AS stock_total,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('desde', r.desde, 'precio', r.precio) ORDER BY r.desde) AS jsonb_agg
           FROM rangos_precio r
          WHERE r.producto_id = p.id), '[]'::jsonb) AS tramos,
    rec.ingrediente_id,
    rec.cantidad_por_unidad,
        CASE
            WHEN rec.ingrediente_id IS NULL THEN NULL::numeric
            ELSE COALESCE(( SELECT sum(s2.cantidad) AS sum
               FROM stock s2
              WHERE s2.producto_id = rec.ingrediente_id), 0::numeric)
        END AS stock_ingrediente,
    tp.paso_kg AS paso_venta,
    td.texto AS descripcion,
    te.texto AS etiqueta,
    p.es_combo,
        CASE
            WHEN p.es_combo THEN combo_detalle(p.id)
            ELSE NULL::jsonb
        END AS combo_detalle,
    p.promo_lleva,
    p.promo_paga
   FROM productos p
     LEFT JOIN categorias c ON c.id = p.categoria_id
     LEFT JOIN tienda_fotos tf ON tf.producto_id = p.id
     LEFT JOIN tienda_presentaciones tp ON tp.producto_id = p.id
     LEFT JOIN tienda_descripciones td ON td.producto_id = p.id
     LEFT JOIN tienda_etiquetas te ON te.producto_id = p.id
     LEFT JOIN ( SELECT recetas_producto.producto_id,
            (array_agg(recetas_producto.ingrediente_id))[1] AS ingrediente_id,
            (array_agg(recetas_producto.cantidad_por_unidad))[1] AS cantidad_por_unidad
           FROM recetas_producto
          GROUP BY recetas_producto.producto_id
         HAVING count(*) = 1) rec ON rec.producto_id = p.id
  WHERE p.activo = true AND p.publicado_tienda = true AND p.precio_venta > 0::numeric;
notify pgrst, 'reload schema';
