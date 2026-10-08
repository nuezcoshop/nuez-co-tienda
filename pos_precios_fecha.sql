-- Nuez Co POS: recuerda CUÁNDO se cambió el precio de cada producto (para el filtro "Precios modificados" en Etiquetas > Góndola).
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No modifica ni borra precios ni datos. Es seguro repetirlo.
-- Registra los cambios desde que lo ejecutás en adelante (los cambios anteriores no se pueden saber).
-- Funciona solo, desde cualquier pantalla: editar un producto, "actualizar precios", importar precios, etc.

alter table public.productos add column if not exists precio_actualizado_en timestamptz;
alter table public.productos add column if not exists precio_huella text;

-- "Huella" = precio de venta + tramos por cantidad. Si cambia la huella, cambió algún precio.
create or replace function public.refrescar_precio_producto(p_producto text) returns void
language plpgsql as $$
declare sig text;
begin
  select round(coalesce(p.precio_venta, 0), 2)::text || '|' ||
         coalesce((select string_agg(round(r.desde, 3)::text || ':' || round(r.precio, 2)::text, ',' order by r.desde)
                     from public.rangos_precio r where r.producto_id::text = p.id::text), '')
    into sig
    from public.productos p where p.id::text = p_producto;
  if sig is null then return; end if;
  update public.productos set precio_huella = sig, precio_actualizado_en = now()
   where id::text = p_producto and precio_huella is distinct from sig;
end $$;

-- Cambio del precio de venta
create or replace function public.trg_precio_producto() returns trigger
language plpgsql as $$
begin
  if new.precio_venta is distinct from old.precio_venta then
    new.precio_actualizado_en := now();
    new.precio_huella := round(coalesce(new.precio_venta, 0), 2)::text || '|' ||
      coalesce((select string_agg(round(r.desde, 3)::text || ':' || round(r.precio, 2)::text, ',' order by r.desde)
                  from public.rangos_precio r where r.producto_id::text = new.id::text), '');
  end if;
  return new;
end $$;
drop trigger if exists trg_precio_producto on public.productos;
create trigger trg_precio_producto before update of precio_venta on public.productos
  for each row execute function public.trg_precio_producto();

-- Cambio de tramos por cantidad (una vez por operación, así guardar sin cambios no marca nada)
create or replace function public.trg_precio_rangos() returns trigger
language plpgsql as $$
declare pid text;
begin
  for pid in select distinct producto_id::text from nuevas loop
    perform public.refrescar_precio_producto(pid);
  end loop;
  return null;
end $$;
drop trigger if exists trg_precio_rangos_ins on public.rangos_precio;
create trigger trg_precio_rangos_ins after insert on public.rangos_precio
  referencing new table as nuevas for each statement execute function public.trg_precio_rangos();
drop trigger if exists trg_precio_rangos_upd on public.rangos_precio;
create trigger trg_precio_rangos_upd after update on public.rangos_precio
  referencing new table as nuevas for each statement execute function public.trg_precio_rangos();

-- Punto de partida: se guarda la huella actual de todos los productos, sin fecha (nadie aparece como "modificado").
update public.productos p set precio_huella =
  round(coalesce(p.precio_venta, 0), 2)::text || '|' ||
  coalesce((select string_agg(round(r.desde, 3)::text || ':' || round(r.precio, 2)::text, ',' order by r.desde)
              from public.rangos_precio r where r.producto_id::text = p.id::text), '')
where p.precio_huella is null;

notify pgrst, 'reload schema';
