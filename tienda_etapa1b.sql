-- Nuez Co: datos editables de la tienda online (pantalla "Tienda online" del sistema).
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No modifica ni borra datos. Es seguro repetirlo.

create table if not exists public.tienda_config (
  id int primary key default 1 check (id = 1),
  nombre text,
  whatsapp text,
  direccion text,
  horario text,
  envio_gratis_desde numeric,
  bienvenida text,
  actualizado_en timestamptz default now()
);

insert into public.tienda_config (id) values (1) on conflict (id) do nothing;

alter table public.tienda_config enable row level security;

drop policy if exists "tienda_config_publico" on public.tienda_config;
create policy "tienda_config_publico" on public.tienda_config
  for select to anon, authenticated
  using (true);

drop policy if exists "tienda_config_admin" on public.tienda_config;
create policy "tienda_config_admin" on public.tienda_config
  for all to authenticated
  using (true) with check (true);

grant select on public.tienda_config to anon;
grant select, insert, update, delete on public.tienda_config to authenticated;

notify pgrst, 'reload schema';
