-- Nuez Co: datos que lee la tienda online. Pegalo UNA vez en Supabase > SQL Editor > Run.
-- No modifica ni borra nada de tus datos actuales. Es seguro repetirlo.

-- 1) Permite elegir qué productos se publican en la tienda (por ahora todos los activos).
alter table public.productos add column if not exists publicado_tienda boolean not null default true;

-- 2) Vista segura con SOLO lo que puede ver el público: nada de costos ni proveedores.
create or replace view public.tienda_productos as
select
  p.id,
  p.nombre,
  p.unidad,
  p.precio_venta,
  p.foto_url,
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
  end as stock_ingrediente
from public.productos p
left join public.categorias c on c.id = p.categoria_id
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

-- 3) Banners de la tienda (se cambian cuando quieras; más adelante tendrán su pantalla en el POS).
create table if not exists public.tienda_banners (
  id bigint generated always as identity primary key,
  imagen_url text not null,
  enlace text,
  titulo text,
  orden int not null default 0,
  activo boolean not null default true,
  desde timestamptz,
  hasta timestamptz,
  creado_en timestamptz default now()
);

alter table public.tienda_banners enable row level security;

drop policy if exists "tienda_banners_publico" on public.tienda_banners;
create policy "tienda_banners_publico" on public.tienda_banners
  for select to anon, authenticated
  using (activo and (desde is null or desde <= now()) and (hasta is null or hasta >= now()));

drop policy if exists "tienda_banners_admin" on public.tienda_banners;
create policy "tienda_banners_admin" on public.tienda_banners
  for all to authenticated
  using (true) with check (true);

grant select on public.tienda_banners to anon;
grant select, insert, update, delete on public.tienda_banners to authenticated;

notify pgrst, 'reload schema';
