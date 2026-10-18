alter table public.tienda_config add column if not exists tarjetas_estilo text, add column if not exists banner_estilo text, add column if not exists banner_alto text;
notify pgrst, 'reload schema';
