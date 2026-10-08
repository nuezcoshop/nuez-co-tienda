-- Nuez Co: cupones de descuento (solo para la tienda online).
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No modifica ni borra datos. Es seguro repetirlo.
-- Requiere haber ejecutado antes tienda_etapa5.sql (pedidos online).

-- 1) Cupones
create table if not exists public.cupones_tienda (
  id bigint generated always as identity primary key,
  codigo text not null,
  tipo text not null check (tipo in ('porcentaje', 'monto')),
  valor numeric not null check (valor > 0),
  minimo numeric not null default 0,
  desde timestamptz,
  hasta timestamptz,
  uso_unico boolean not null default false,   -- una sola vez por cliente (se reconoce por el WhatsApp)
  max_usos integer,                            -- límite total de usos (vacío = sin límite)
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
create unique index if not exists cupones_tienda_codigo_uq on public.cupones_tienda (upper(codigo));

-- 2) Usos de cupones (quién lo usó y en qué pedido)
create table if not exists public.cupones_usos (
  id bigint generated always as identity primary key,
  cupon_id bigint not null references public.cupones_tienda(id) on delete cascade,
  telefono text,
  pedido_id bigint,
  creado_en timestamptz not null default now()
);
create index if not exists cupones_usos_cupon_idx on public.cupones_usos (cupon_id);

alter table public.cupones_tienda enable row level security;
alter table public.cupones_usos enable row level security;
drop policy if exists "cupones_admin" on public.cupones_tienda;
create policy "cupones_admin" on public.cupones_tienda for all to authenticated using (true) with check (true);
drop policy if exists "cupones_usos_admin" on public.cupones_usos;
create policy "cupones_usos_admin" on public.cupones_usos for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.cupones_tienda to authenticated;
grant select, insert, update, delete on public.cupones_usos to authenticated;

-- 3) El pedido guarda el cupón aplicado
alter table public.pedidos_online add column if not exists cupon_codigo text;
alter table public.pedidos_online add column if not exists cupon_descuento numeric not null default 0;

-- 4) Validación de un cupón (la usa la tienda; el público NO puede leer la tabla de cupones)
create or replace function public.validar_cupon(p_codigo text, p_subtotal numeric, p_telefono text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.cupones_tienda%rowtype;
  tel text := right(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'), 8);
  desc_monto numeric;
begin
  select * into c from public.cupones_tienda where upper(codigo) = upper(trim(coalesce(p_codigo, ''))) limit 1;
  if not found or not c.activo then
    return jsonb_build_object('ok', false, 'mensaje', 'Ese cupón no existe o no está activo.');
  end if;
  if c.desde is not null and c.desde > now() then
    return jsonb_build_object('ok', false, 'mensaje', 'Ese cupón todavía no está vigente.');
  end if;
  if c.hasta is not null and c.hasta < now() then
    return jsonb_build_object('ok', false, 'mensaje', 'Ese cupón ya venció.');
  end if;
  if coalesce(p_subtotal, 0) < c.minimo then
    return jsonb_build_object('ok', false, 'mensaje', 'Este cupón se usa en compras desde $' || to_char(round(c.minimo), 'FM999G999G999'));
  end if;
  if c.max_usos is not null and (select count(*) from public.cupones_usos u where u.cupon_id = c.id) >= c.max_usos then
    return jsonb_build_object('ok', false, 'mensaje', 'Este cupón ya alcanzó su límite de usos.');
  end if;
  if c.uso_unico then
    if length(tel) < 8 then
      return jsonb_build_object('ok', false, 'necesita_telefono', true, 'mensaje', 'Escribí tu WhatsApp arriba para validar este cupón.');
    end if;
    if exists (select 1 from public.cupones_usos u where u.cupon_id = c.id and u.telefono = tel) then
      return jsonb_build_object('ok', false, 'mensaje', 'Ya usaste este cupón.');
    end if;
  end if;

  if c.tipo = 'porcentaje' then
    desc_monto := round(p_subtotal * least(c.valor, 100) / 100);
  else
    desc_monto := least(c.valor, p_subtotal);
  end if;

  return jsonb_build_object('ok', true, 'codigo', upper(c.codigo), 'tipo', c.tipo, 'valor', c.valor, 'descuento', desc_monto,
                            'mensaje', 'Cupón aplicado');
end;
$$;
revoke all on function public.validar_cupon(text, numeric, text) from public;
grant execute on function public.validar_cupon(text, numeric, text) to anon, authenticated;

-- 5) La creación de pedidos ahora valida y registra el cupón (si viene uno)
create or replace function public.crear_pedido_online(p jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  nid bigint;
  its jsonb := p -> 'items';
  cod text := trim(coalesce(p ->> 'cupon', ''));
  sub numeric := greatest(coalesce(nullif(p ->> 'total_productos', '')::numeric, 0), 0);
  v jsonb;
  cid bigint;
  tel text := right(regexp_replace(coalesce(p ->> 'telefono', ''), '\D', '', 'g'), 8);
begin
  if its is null or jsonb_typeof(its) <> 'array' or jsonb_array_length(its) = 0 or jsonb_array_length(its) > 100 then
    raise exception 'Pedido inválido';
  end if;

  if cod <> '' then
    v := public.validar_cupon(cod, sub, p ->> 'telefono');
    if not coalesce((v ->> 'ok')::boolean, false) then
      raise exception 'cupon: %', coalesce(v ->> 'mensaje', 'cupón inválido');
    end if;
  end if;

  insert into public.pedidos_online (
    nombre, telefono, entrega, direccion, lat, lng, costo_envio, envio_gratis, fuera_de_zona,
    medio_pago, notas, total_productos, items, cupon_codigo, cupon_descuento
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
    sub,
    its,
    case when cod <> '' then v ->> 'codigo' else null end,
    case when cod <> '' then (v ->> 'descuento')::numeric else 0 end
  )
  returning id into nid;

  if cod <> '' then
    select id into cid from public.cupones_tienda where upper(codigo) = upper(v ->> 'codigo') limit 1;
    insert into public.cupones_usos (cupon_id, telefono, pedido_id) values (cid, nullif(tel, ''), nid);
  end if;

  return nid;
end;
$$;
revoke all on function public.crear_pedido_online(jsonb) from public;
grant execute on function public.crear_pedido_online(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
