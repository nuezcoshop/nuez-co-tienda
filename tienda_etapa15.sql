-- Nuez Co: título, descripción e imagen del link (WhatsApp, Google, redes).
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No modifica ni borra datos. Es seguro repetirlo.

alter table public.tienda_config add column if not exists seo_titulo text;
alter table public.tienda_config add column if not exists seo_descripcion text;
alter table public.tienda_config add column if not exists seo_imagen text;

notify pgrst, 'reload schema';
