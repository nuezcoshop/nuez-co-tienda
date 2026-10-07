-- Nuez Co: pedidos online. La tienda guarda cada pedido y el sistema (pantalla "Pedidos online") lo gestiona.
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No modifica ni borra datos. Es seguro repetirlo.

-- 1) Los productos pueden marcarse como "sin control de stock" (se usa para el renglón "Envío a domicilio").
alter table public.productos add column if not exists controla_stock boolean not null default true;

-- 2) Las ventas en espera pueden venir de un pedido online.
alter table public.ventas_en_espera add column if not exists pedido_id bigint;

-- 3) Tabla de pedidos online
create table if not exists public.pedidos_online (
  id bigint generated always as identity primary key,
  creado_en timestamptz not null default now(),
  estado text not null default 'nuevo' check (estado in ('nuevo', 'preparado', 'entregado', 'cancelado')),
  pagado boolean not null default false,
  pagado_en timestamptz,
  venta_id text,
  nombre text,
  telefono text,
  entrega text not null default 'retiro' check (entrega in ('retiro', 'envio')),
  direccion text,
  lat double precision,
  lng double precision,
  costo_envio numeric not null default 0,
  envio_gratis boolean not null default false,
  fuera_de_zona boolean not null default false,
  medio_pago text,
  notas text,
  total_productos numeric not null default 0,
  items jsonb not null default '[]'::jsonb
);

alter table public.pedidos_online enable row level security;

drop policy if exists "pedidos_online_admin" on public.pedidos_online;
create policy "pedidos_online_admin" on public.pedidos_online
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.pedidos_online to authenticated;

-- 4) La tienda crea pedidos SOLO a través de esta función (el público no puede leer ni modificar pedidos).
create or replace function public.crear_pedido_online(p jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  nid bigint;
  its jsonb := p -> 'items';
begin
  if its is null or jsonb_typeof(its) <> 'array' or jsonb_array_length(its) = 0 or jsonb_array_length(its) > 100 then
    raise exception 'Pedido inválido';
  end if;

  insert into public.pedidos_online (
    nombre, telefono, entrega, direccion, lat, lng, costo_envio, envio_gratis, fuera_de_zona,
    medio_pago, notas, total_productos, items
  ) values (
    left(coalesce(p ->> 'nombre', ''), 120),
    left(coalesce(p ->> 'telefono', ''), 40),
    case when p ->> 'entrega' = 'envio' then 'envio' else 'retiro' end,
    left(coalesce(p ->> 'direccion', ''), 250),
    nullif(p ->> 'lat', '')::double precision,
    nullif(p ->> 'lng', '')::double precision,
    greatest(coalesce(nullif(p ->> 'costo_envio', '')::numeric, 0), 0),
    coalesce((p ->> 'envio_gratis')::boolean, false),
    coalesce((p ->> 'fuera_de_zona')::boolean, false),
    left(coalesce(p ->> 'medio_pago', ''), 40),
    left(coalesce(p ->> 'notas', ''), 500),
    greatest(coalesce(nullif(p ->> 'total_productos', '')::numeric, 0), 0),
    its
  )
  returning id into nid;

  return nid;
end;
$$;

revoke all on function public.crear_pedido_online(jsonb) from public;
grant execute on function public.crear_pedido_online(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
