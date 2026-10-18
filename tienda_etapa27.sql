alter table public.tienda_config add column if not exists peso_titulos numeric, add column if not exists peso_textos numeric, add column if not exists peso_botones numeric;
notify pgrst, 'reload schema';
