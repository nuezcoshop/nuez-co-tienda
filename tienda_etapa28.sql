alter table public.tienda_config add column if not exists bloques_inicio jsonb;
notify pgrst, 'reload schema';
