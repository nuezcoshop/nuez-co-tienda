-- Nuez Co: imagen ancha opcional para cada banner (versión computadora).
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No modifica ni borra datos. Es seguro repetirlo.
alter table public.tienda_banners add column if not exists imagen_escritorio_url text;
notify pgrst, 'reload schema';
