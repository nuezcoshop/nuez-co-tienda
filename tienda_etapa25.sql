-- Nuez Co: combos (varios productos vendidos juntos con precio promocional).
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No borra datos. Es seguro repetirlo.

alter table public.productos add column if not exists es_combo boolean not null default false;

create table if not exists public.combo_items (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references public.productos(id) on delete cascade,
  producto_id uuid not null references public.productos(id),
  cantidad numeric not null check (cantidad > 0),
  unique (combo_id, producto_id)
);
create index if not exists combo_items_combo_idx on public.combo_items (combo_id);
create index if not exists combo_items_producto_idx on public.combo_items (producto_id);
alter table public.combo_items enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'combo_items' and policyname = 'usuarios autenticados acceso total') then
    create policy "usuarios autenticados acceso total" on public.combo_items
      for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
  end if;
end $$;

-- En cada renglón de venta se recuerda de qué combo viene (para mostrarlo como un solo renglón).
alter table public.detalle_ventas add column if not exists combo_id uuid;
alter table public.detalle_ventas add column if not exists combo_nombre text;
alter table public.detalle_ventas add column if not exists combo_cantidad numeric;

-- Cuántos combos se pueden armar con el stock actual (el producto que primero se acaba manda).
create or replace function public.stock_combo(cid uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n int;
  inactivos int;
  menor numeric;
begin
  select count(*), count(*) filter (where p.activo is not true or p.archivado is true)
    into n, inactivos
  from public.combo_items ci join public.productos p on p.id = ci.producto_id
  where ci.combo_id = cid;
  if n = 0 or inactivos > 0 then
    return 0;
  end if;
  select min(floor(coalesce((select sum(s.cantidad) from public.stock s where s.producto_id = ci.producto_id), 0) / ci.cantidad))
    into menor
  from public.combo_items ci join public.productos p on p.id = ci.producto_id
  where ci.combo_id = cid and coalesce(p.controla_stock, true);
  return greatest(coalesce(menor, 9999), 0);
end;
$$;
revoke all on function public.stock_combo(uuid) from public;
grant execute on function public.stock_combo(uuid) to anon, authenticated;

-- Qué incluye el combo (para mostrarlo en la tienda).
create or replace function public.combo_detalle(cid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('nombre', p.nombre, 'cantidad', ci.cantidad, 'unidad', p.unidad) order by p.nombre), '[]'::jsonb)
  from public.combo_items ci join public.productos p on p.id = ci.producto_id
  where ci.combo_id = cid;
$$;
revoke all on function public.combo_detalle(uuid) from public;
grant execute on function public.combo_detalle(uuid) to anon, authenticated;

-- La tienda: el stock de un combo es el de sus componentes. Mismas columnas de siempre + 2 al final.
create or replace view public.tienda_productos as
 SELECT p.id,
    p.nombre,
    p.unidad,
    p.precio_venta,
    COALESCE(tf.url, p.foto_url) AS foto_url,
    c.nombre AS categoria,
    CASE WHEN p.es_combo THEN public.stock_combo(p.id)
         ELSE COALESCE(( SELECT sum(s.cantidad) AS sum FROM stock s WHERE s.producto_id = p.id), 0::numeric) END AS stock_total,
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
    CASE WHEN p.es_combo THEN public.combo_detalle(p.id) ELSE NULL::jsonb END AS combo_detalle
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
