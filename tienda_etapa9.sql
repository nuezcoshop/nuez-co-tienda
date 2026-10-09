-- Nuez Co: sección "Detrás de Nuez Co / Nuestra historia" en el Inicio de la tienda.
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No modifica ni borra datos. Es seguro repetirlo.

alter table public.tienda_config add column if not exists nosotros_activo boolean not null default false;
alter table public.tienda_config add column if not exists nosotros_titulo text;      -- título de la sección (ej: Detrás de Nuez Co)
alter table public.tienda_config add column if not exists nosotros_subtitulo text;   -- título breve y personal
alter table public.tienda_config add column if not exists nosotros_texto text;       -- historia corta
alter table public.tienda_config add column if not exists nosotros_foto text;        -- foto (URL)

notify pgrst, 'reload schema';
