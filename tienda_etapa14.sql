-- Nuez Co: enlace de Instagram para el pie de la tienda.
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No modifica ni borra datos. Es seguro repetirlo.

alter table public.tienda_config add column if not exists instagram text;

notify pgrst, 'reload schema';
