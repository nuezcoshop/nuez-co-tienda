-- Nuez Co: inicio de la tienda (novedades destacadas, banners de inicio, ubicación).
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No modifica ni borra datos. Es seguro repetirlo.
-- Requiere haber ejecutado antes tienda_etapa1.sql y tienda_etapa1b.sql.

-- 1) Banners: "principal" se ven arriba en todas las páginas; "inicio" solo en el Inicio, abajo.
alter table public.tienda_banners add column if not exists zona text not null default 'principal';

-- 2) Título de la sección destacada y enlace de ubicación (opcional)
alter table public.tienda_config add column if not exists destacados_titulo text;
alter table public.tienda_config add column if not exists ubicacion_link text;

-- 3) Productos destacados del Inicio (los eligen desde el sistema)
do $$
declare tipo text;
begin
  select format_type(a.atttypid, a.atttypmod) into tipo
    from pg_attribute a
   where a.attrelid = 'public.productos'::regclass and a.attname = 'id';
  execute format(
    'create table if not exists public.tienda_destacados (producto_id %s primary key references public.productos(id) on delete cascade, orden int not null default 0)',
    tipo);
end $$;
alter table public.tienda_destacados enable row level security;
drop policy if exists "tienda_destacados_publico" on public.tienda_destacados;
create policy "tienda_destacados_publico" on public.tienda_destacados for select to anon, authenticated using (true);
drop policy if exists "tienda_destacados_admin" on public.tienda_destacados;
create policy "tienda_destacados_admin" on public.tienda_destacados for all to authenticated using (true) with check (true);
grant select on public.tienda_destacados to anon;
grant select, insert, update, delete on public.tienda_destacados to authenticated;

notify pgrst, 'reload schema';
