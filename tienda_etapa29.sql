alter table public.tienda_config
  add column if not exists borde_chips numeric, add column if not exists borde_botones numeric, add column if not exists borde_buscador numeric,
  add column if not exists sombra_chips text, add column if not exists sombra_botones text, add column if not exists sombra_buscador text;
notify pgrst, 'reload schema';
