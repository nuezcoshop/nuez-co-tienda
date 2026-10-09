-- Nuez Co: orden elegible de las categorías en el menú de la tienda.
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No modifica ni borra datos. Es seguro repetirlo.

alter table public.tienda_config add column if not exists categorias_orden jsonb;

notify pgrst, 'reload schema';
