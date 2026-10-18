-- Diseños guardados de la tienda (foto de colores, letras, bordes y secciones) para poder probar y volver atrás.
create table if not exists public.tienda_disenos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  datos jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);
alter table public.tienda_disenos enable row level security;
create policy "usuarios autenticados acceso total" on public.tienda_disenos for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
notify pgrst, 'reload schema';
