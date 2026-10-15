-- Nuez Co: seguimiento del pedido por enlace privado (sin registro del cliente).
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No borra datos. Es seguro repetirlo.

alter table public.pedidos_online add column if not exists token text;
update public.pedidos_online set token = replace(gen_random_uuid()::text, '-', '') where token is null;
alter table public.pedidos_online alter column token set default replace(gen_random_uuid()::text, '-', '');
create unique index if not exists pedidos_online_token_idx on public.pedidos_online (token);

-- Crea el pedido (misma lógica de siempre) y devuelve también el código privado de seguimiento.
create or replace function public.crear_pedido_online_v2(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  nid bigint;
  tk text;
begin
  nid := public.crear_pedido_online(p);
  select token into tk from public.pedidos_online where id = nid;
  return jsonb_build_object('id', nid, 'token', tk);
end;
$$;
revoke all on function public.crear_pedido_online_v2(jsonb) from public;
grant execute on function public.crear_pedido_online_v2(jsonb) to anon, authenticated;

-- Seguimiento: con el código privado devuelve solo estado y resumen (sin teléfono ni dirección).
create or replace function public.seguimiento_pedido(t text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.pedidos_online%rowtype;
begin
  if t is null or length(t) < 20 then
    return null;
  end if;
  select * into r from public.pedidos_online where token = t limit 1;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'id', r.id,
    'estado', r.estado,
    'entrega', r.entrega,
    'creado_en', r.creado_en,
    'nombre', split_part(coalesce(r.nombre, ''), ' ', 1),
    'total', coalesce(r.total_productos, 0) - coalesce(r.cupon_descuento, 0) - coalesce(r.descuento_escalon, 0) + coalesce(r.costo_envio, 0),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', i ->> 'nombre', 'cantidad', i -> 'cantidad', 'unidad', i ->> 'unidad'))
      from jsonb_array_elements(r.items) i
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.seguimiento_pedido(text) from public;
grant execute on function public.seguimiento_pedido(text) to anon, authenticated;

notify pgrst, 'reload schema';
