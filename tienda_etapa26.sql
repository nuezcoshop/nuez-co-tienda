-- Nuez Co: tipografía, tamaños y colores de texto/botones de la tienda (se editan desde "Tienda online" en el POS).
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No borra datos. Es seguro repetirlo.
alter table public.tienda_config add column if not exists fuente_titulos text;
alter table public.tienda_config add column if not exists fuente_textos text;
alter table public.tienda_config add column if not exists fuente_botones text;
alter table public.tienda_config add column if not exists color_titulos text;
alter table public.tienda_config add column if not exists color_textos text;
alter table public.tienda_config add column if not exists color_boton_texto text;
alter table public.tienda_config add column if not exists tam_titulos numeric;
alter table public.tienda_config add column if not exists tam_textos numeric;
alter table public.tienda_config add column if not exists tam_botones numeric;
notify pgrst, 'reload schema';
