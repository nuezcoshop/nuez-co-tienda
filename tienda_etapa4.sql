-- Nuez Co: calculador de envío por zona (ubicación de la sucursal y precios por distancia).
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No modifica ni borra datos. Es seguro repetirlo.
-- Requiere haber ejecutado antes tienda_etapa1b.sql.

alter table public.tienda_config add column if not exists sucursal_lat double precision;
alter table public.tienda_config add column if not exists sucursal_lng double precision;
alter table public.tienda_config add column if not exists zonas_envio jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
