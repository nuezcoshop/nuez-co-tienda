-- Nuez Co: descripciones de productos hasta 250 caracteres (antes 140).
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No borra datos: amplía el largo permitido
-- y vuelve a crear la vista "tienda_productos" idéntica (es necesario porque depende de esa columna).

begin;

drop view public.tienda_productos;

alter table public.tienda_descripciones alter column texto type varchar(250);

create view public.tienda_productos as
 SELECT p.id,
    p.nombre,
    p.unidad,
    p.precio_venta,
    COALESCE(tf.url, p.foto_url) AS foto_url,
    c.nombre AS categoria,
    COALESCE(( SELECT sum(s.cantidad) AS sum
           FROM stock s
          WHERE s.producto_id = p.id), 0::numeric) AS stock_total,
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
    te.texto AS etiqueta
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

grant all on public.tienda_productos to anon, authenticated, service_role;

commit;

notify pgrst, 'reload schema';
