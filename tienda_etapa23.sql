-- Nuez Co: escalones de descuento / envío gratis según el monto de la compra (tienda online).
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No borra datos. Es seguro repetirlo.

alter table public.tienda_config add column if not exists escalones jsonb not null default '[]'::jsonb;
alter table public.pedidos_online add column if not exists descuento_escalon numeric not null default 0;

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
  esc jsonb;
  t jsonb;
  mejor jsonb := null;
  esc_desc numeric := 0;
  gratis_envio boolean := false;
  tel text := right(regexp_replace(coalesce(p ->> 'telefono', ''), '\D', '', 'g'), 8);
begin
  if its is null or jsonb_typeof(its) <> 'array' or jsonb_array_length(its) = 0 or jsonb_array_length(its) > 100 then
    raise exception 'Pedido inválido';
  end if;

  -- Descuento automático por monto de compra (escalones configurados en el sistema).
  select escalones into esc from public.tienda_config where id = 1;
  if esc is not null and jsonb_typeof(esc) = 'array' then
    for t in select * from jsonb_array_elements(esc) loop
      if t ->> 'tipo' = 'envio_gratis' then
        -- El envío gratis rige solo para entrega a domicilio y reemplaza al descuento.
        if p ->> 'entrega' = 'envio' and sub >= coalesce(nullif(t ->> 'desde', '')::numeric, 0) then
          gratis_envio := true;
        end if;
      elsif sub >= coalesce(nullif(t ->> 'desde', '')::numeric, 0)
         and (mejor is null or coalesce(nullif(t ->> 'desde', '')::numeric, 0) >= coalesce(nullif(mejor ->> 'desde', '')::numeric, 0)) then
        mejor := t;
      end if;
    end loop;
    if mejor is not null and not gratis_envio then
      if mejor ->> 'tipo' = 'porcentaje' then
        esc_desc := round(sub * least(greatest(coalesce(nullif(mejor ->> 'valor', '')::numeric, 0), 0), 100) / 100);
      elsif mejor ->> 'tipo' = 'monto' then
        esc_desc := least(greatest(coalesce(nullif(mejor ->> 'valor', '')::numeric, 0), 0), sub);
      end if;
    end if;
  end if;

  if cod <> '' then
    v := public.validar_cupon(cod, sub, p ->> 'telefono');
    if not coalesce((v ->> 'ok')::boolean, false) then
      raise exception 'cupon: %', coalesce(v ->> 'mensaje', 'cupón inválido');
    end if;
    -- El descuento por monto y el cupón no se suman: rige el más conveniente para el cliente.
    if esc_desc > coalesce((v ->> 'descuento')::numeric, 0) then
      cod := '';
    else
      esc_desc := 0;
    end if;
  end if;

  insert into public.pedidos_online (
    nombre, telefono, entrega, direccion, lat, lng, costo_envio, envio_gratis, fuera_de_zona,
    medio_pago, notas, total_productos, items, cupon_codigo, cupon_descuento, descuento_escalon
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
    case when cod <> '' then (v ->> 'descuento')::numeric else 0 end,
    esc_desc
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
