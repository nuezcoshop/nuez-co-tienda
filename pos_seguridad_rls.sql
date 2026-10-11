-- Nuez Co: cierra dos agujeros de seguridad (solo usuarios logueados del POS pueden tocar estas tablas).
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No modifica ni borra datos. Es seguro repetirlo.

alter table public.configuracion_venta_rapida enable row level security;
drop policy if exists "usuarios autenticados acceso total" on public.configuracion_venta_rapida;
create policy "usuarios autenticados acceso total" on public.configuracion_venta_rapida for all to authenticated using (true) with check (true);

drop policy if exists "Crear ubicaciones del deposito" on public.ubicaciones_deposito;
drop policy if exists "Editar ubicaciones del deposito" on public.ubicaciones_deposito;
drop policy if exists "Eliminar ubicaciones del deposito" on public.ubicaciones_deposito;
drop policy if exists "Leer ubicaciones del deposito" on public.ubicaciones_deposito;
drop policy if exists "ubicaciones_deposito_admin" on public.ubicaciones_deposito;
create policy "ubicaciones_deposito_admin" on public.ubicaciones_deposito for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
