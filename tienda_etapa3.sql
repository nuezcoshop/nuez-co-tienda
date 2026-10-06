-- Nuez Co: "cómo se vende cada producto al peso" en la tienda (de a 50 g, 100 g, 500 g, 1 kg...).
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No modifica ni borra datos. Es seguro repetirlo.
-- Requiere haber ejecutado antes tienda_etapa2.sql.

do $$
declare tipo text;
begin
  select format_type(a.atttypid, a.atttypmod) into tipo
    from pg_attribute a
   where a.attrelid = 'public.productos'::regclass and a.attname = 'id';
  execute format(
    'create table if not exists public.tienda_presentaciones (producto_id %s primary key references public.productos(id) on delete cascade, paso_kg numeric not null check (paso_kg > 0), actualizado_en timestamptz default now())',
    tipo);
end $$;
alter table public.tienda_presentaciones enable row level security;
drop policy if exists "tienda_present_admin" on public.tienda_presentaciones;
create policy "tienda_present_admin" on public.tienda_presentaciones for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.tienda_presentaciones to authenticated;

create or replace view public.tienda_productos as
select
  p.id,
  p.nombre,
  p.unidad,
  p.precio_venta,
  coalesce(tf.url, p.foto_url) as foto_url,
  c.nombre as categoria,
  coalesce((select sum(s.cantidad) from public.stock s where s.producto_id = p.id), 0) as stock_total,
  coalesce(
    (select jsonb_agg(jsonb_build_object('desde', r.desde, 'precio', r.precio) order by r.desde)
       from public.rangos_precio r where r.producto_id = p.id),
    '[]'::jsonb
  ) as tramos,
  rec.ingrediente_id,
  rec.cantidad_por_unidad,
  case
    when rec.ingrediente_id is null then null
    else coalesce((select sum(s2.cantidad) from public.stock s2 where s2.producto_id = rec.ingrediente_id), 0)
  end as stock_ingrediente,
  tp.paso_kg as paso_venta
from public.productos p
left join public.categorias c on c.id = p.categoria_id
left join public.tienda_fotos tf on tf.producto_id = p.id
left join public.tienda_presentaciones tp on tp.producto_id = p.id
left join (
  select producto_id,
         (array_agg(ingrediente_id))[1] as ingrediente_id,
         (array_agg(cantidad_por_unidad))[1] as cantidad_por_unidad
  from public.recetas_producto
  group by producto_id
  having count(*) = 1
) rec on rec.producto_id = p.id
where p.activo = true
  and p.publicado_tienda = true
  and p.precio_venta > 0;

grant select on public.tienda_productos to anon, authenticated;

notify pgrst, 'reload schema';
