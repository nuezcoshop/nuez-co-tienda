alter table public.tienda_config add column if not exists cabecera_estilo text, add column if not exists tarjeta_color_1 text, add column if not exists tarjeta_color_2 text, add column if not exists tarjeta_color_3 text;
notify pgrst, 'reload schema';
