-- Nuez Co: color de fondo elegible para la tienda.
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No modifica ni borra datos. Es seguro repetirlo.

alter table public.tienda_config add column if not exists color_fondo text;

notify pgrst, 'reload schema';
