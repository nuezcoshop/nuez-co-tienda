-- Nuez Co POS: control de vencimientos por lote + devoluciones con rastreo de la venta.
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No modifica ni borra datos existentes. Es seguro repetirlo.

alter table public.productos add column if not exists controla_vencimiento boolean default false;

-- Cada "tanda" de mercadería que entra, con su fecha de vencimiento.
create table if not exists public.lotes_stock (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  vencimiento date,
  cantidad_inicial numeric not null,
  cantidad_restante numeric not null,
  origen text not null default 'manual',
  compra_id uuid,
  nota text,
  activo boolean not null default true,
  ingreso timestamptz not null default now(),
  usuario_id uuid
);
create index if not exists lotes_stock_producto_idx on public.lotes_stock (producto_id, vencimiento);

-- De qué lote(s) salió lo que se vendió en cada renglón de una venta.
create table if not exists public.detalle_venta_lotes (
  id uuid primary key default gen_random_uuid(),
  detalle_venta_id uuid not null references public.detalle_ventas(id) on delete cascade,
  venta_id uuid not null,
  producto_id uuid not null,
  lote_id uuid not null references public.lotes_stock(id),
  cantidad numeric not null,
  devuelta numeric not null default 0,
  creado timestamptz not null default now()
);
create index if not exists dvl_lote_idx on public.detalle_venta_lotes (lote_id);
create index if not exists dvl_venta_idx on public.detalle_venta_lotes (venta_id);
create index if not exists dvl_detalle_idx on public.detalle_venta_lotes (detalle_venta_id);

create table if not exists public.devoluciones (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  venta_id uuid not null references public.ventas(id),
  fecha timestamptz not null default now(),
  motivo text,
  destino text not null default 'stock',
  monto numeric not null default 0,
  medio_pago text,
  nota text,
  usuario_id uuid
);
create index if not exists devoluciones_venta_idx on public.devoluciones (venta_id);

create table if not exists public.detalle_devoluciones (
  id uuid primary key default gen_random_uuid(),
  devolucion_id uuid not null references public.devoluciones(id) on delete cascade,
  detalle_venta_id uuid not null,
  producto_id uuid not null,
  cantidad numeric not null,
  monto numeric,
  lotes jsonb
);
create index if not exists dd_detalle_idx on public.detalle_devoluciones (detalle_venta_id);

do $$
declare t text;
begin
  foreach t in array array['lotes_stock','detalle_venta_lotes','devoluciones','detalle_devoluciones'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policy where polrelid = ('public.' || t)::regclass and polname = 'usuarios autenticados acceso total') then
      execute format('create policy "usuarios autenticados acceso total" on public.%I for all to authenticated using (true) with check (true)', t);
    end if;
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Al venderse un producto con control de vencimiento: descuenta del lote que vence primero y deja registro.
-- Si algo falla, la venta NUNCA se bloquea (el error se ignora).
create or replace function public.consumir_lotes_venta()
returns trigger language plpgsql as $$
declare
  v_ctrl boolean;
  v_resta numeric := NEW.cantidad;
  v_toma numeric;
  r record;
begin
  select controla_vencimiento into v_ctrl from public.productos where id = NEW.producto_id;
  if not coalesce(v_ctrl, false) then return NEW; end if;
  for r in
    select id, cantidad_restante from public.lotes_stock
    where producto_id = NEW.producto_id and activo and cantidad_restante > 0
    order by vencimiento asc nulls last, ingreso asc
    for update
  loop
    exit when v_resta <= 0;
    v_toma := least(r.cantidad_restante, v_resta);
    update public.lotes_stock set cantidad_restante = cantidad_restante - v_toma where id = r.id;
    insert into public.detalle_venta_lotes (detalle_venta_id, venta_id, producto_id, lote_id, cantidad)
    values (NEW.id, NEW.venta_id, NEW.producto_id, r.id, v_toma);
    v_resta := v_resta - v_toma;
  end loop;
  return NEW;
exception when others then
  return NEW;
end;
$$;

-- Si se anula una venta, lo que salió de cada lote vuelve al lote.
create or replace function public.restaurar_lotes_anulacion()
returns trigger language plpgsql as $$
begin
  if NEW.estado = 'anulada' and OLD.estado is distinct from 'anulada' then
    update public.lotes_stock l
       set cantidad_restante = l.cantidad_restante + x.pend
      from (select lote_id, sum(cantidad - devuelta) as pend from public.detalle_venta_lotes where venta_id = NEW.id group by lote_id) x
     where l.id = x.lote_id and x.pend > 0;
  end if;
  return NEW;
exception when others then
  return NEW;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_consumir_lotes_venta') then
    create trigger trg_consumir_lotes_venta after insert on public.detalle_ventas
      for each row execute function public.consumir_lotes_venta();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_restaurar_lotes_anulacion') then
    create trigger trg_restaurar_lotes_anulacion after update of estado on public.ventas
      for each row execute function public.restaurar_lotes_anulacion();
  end if;
end $$;

-- Registra una devolución completa de una sola vez (todo o nada).
create or replace function public.registrar_devolucion(p jsonb)
returns uuid language plpgsql as $$
declare
  v_venta uuid := (p->>'venta_id')::uuid;
  v_dest text := coalesce(p->>'destino', 'stock');
  v_ubic uuid := nullif(p->>'ubicacion_id', '')::uuid;
  v_monto numeric := coalesce(nullif(p->>'monto', '')::numeric, 0);
  v_medio text := nullif(p->>'medio_pago', '');
  v_apertura uuid := nullif(p->>'apertura_id', '')::uuid;
  v_estado text;
  v_numero integer;
  v_dev uuid;
  v_it jsonb;
  v_det record;
  v_ya numeric;
  v_cant numeric;
  v_resta numeric;
  v_toma numeric;
  v_lotes jsonb;
  v_hay boolean := false;
  v_uid uuid;
  l record;
begin
  select id into v_uid from public.perfiles where id = auth.uid();
  select estado, numero into v_estado, v_numero from public.ventas where id = v_venta;
  if not found then raise exception 'La venta no existe'; end if;
  if v_estado = 'anulada' then raise exception 'La venta está anulada'; end if;
  if v_dest not in ('stock', 'descarte') then raise exception 'Destino inválido'; end if;
  if v_dest = 'stock' and v_ubic is null then raise exception 'Falta la ubicación del stock'; end if;

  insert into public.devoluciones (venta_id, motivo, destino, monto, medio_pago, nota, usuario_id)
  values (v_venta, p->>'motivo', v_dest, v_monto, v_medio, p->>'nota', v_uid)
  returning id into v_dev;

  for v_it in select * from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) loop
    v_cant := nullif(v_it->>'cantidad', '')::numeric;
    continue when v_cant is null or v_cant <= 0;
    select * into v_det from public.detalle_ventas where id = (v_it->>'detalle_venta_id')::uuid and venta_id = v_venta;
    if not found then raise exception 'Un producto no pertenece a esa venta'; end if;
    select coalesce(sum(cantidad), 0) into v_ya from public.detalle_devoluciones where detalle_venta_id = v_det.id;
    if v_cant > (v_det.cantidad - v_ya) + 0.0005 then
      raise exception 'Se está devolviendo más de lo que se vendió';
    end if;
    v_hay := true;
    v_lotes := '[]'::jsonb;
    v_resta := v_cant;
    for l in
      select id, lote_id, cantidad, devuelta from public.detalle_venta_lotes
      where detalle_venta_id = v_det.id and cantidad - devuelta > 0
      order by creado, id
    loop
      exit when v_resta <= 0;
      v_toma := least(l.cantidad - l.devuelta, v_resta);
      update public.detalle_venta_lotes set devuelta = devuelta + v_toma where id = l.id;
      if v_dest = 'stock' then
        update public.lotes_stock set cantidad_restante = cantidad_restante + v_toma where id = l.lote_id;
      end if;
      v_lotes := v_lotes || jsonb_build_array(jsonb_build_object('lote_id', l.lote_id, 'cantidad', v_toma));
      v_resta := v_resta - v_toma;
    end loop;
    insert into public.detalle_devoluciones (devolucion_id, detalle_venta_id, producto_id, cantidad, monto, lotes)
    values (v_dev, v_det.id, v_det.producto_id, v_cant, nullif(v_it->>'monto', '')::numeric, v_lotes);
    if v_dest = 'stock' then
      perform public.ajustar_stock(v_det.producto_id, v_ubic, v_cant);
    end if;
  end loop;

  if not v_hay then raise exception 'No hay productos para devolver'; end if;

  if v_medio is not null and v_monto > 0 then
    insert into public.movimientos_caja (apertura_id, tipo, concepto, importe, medio_pago, referencia, usuario_id)
    values (v_apertura, 'egreso', 'Devolución venta #' || v_numero, v_monto, v_medio, 'devolucion:' || v_dev, v_uid);
  end if;

  insert into public.auditoria (usuario_id, accion, modulo, descripcion)
  values (v_uid, 'devolucion', 'ventas', 'Devolución de la venta #' || v_numero || ' (' || v_dest || '): ' || coalesce(p->>'motivo', ''));

  return v_dev;
end;
$$;

revoke all on function public.registrar_devolucion(jsonb) from public;
grant execute on function public.registrar_devolucion(jsonb) to authenticated;

notify pgrst, 'reload schema';
