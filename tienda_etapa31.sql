-- Los productos por unidad pueden tener precio por cantidad (desde X unidades). El bloqueo queda solo para productos por kilo no pesables.
create or replace function public.fn_bloquear_tramo_si_no_pesable()
returns trigger language plpgsql as $$
declare
  es_pesable boolean;
  la_unidad text;
begin
  select pesable, unidad into es_pesable, la_unidad from productos where id = new.producto_id;
  if es_pesable is false and la_unidad = 'kg' then
    raise exception 'No se puede guardar un tramo de precio para un producto marcado como "no pesable" (producto_id: %)', new.producto_id;
  end if;
  return new;
end;
$$;

create or replace function public.fn_limpiar_tramos_si_no_pesable()
returns trigger language plpgsql as $$
begin
  if new.pesable = false and new.unidad = 'kg' then
    delete from rangos_precio where producto_id = new.id;
  end if;
  return new;
end;
$$;
