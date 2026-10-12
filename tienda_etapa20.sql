-- Nuez Co: contador de visitas de la tienda (se ve en el POS > Tienda online).
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No modifica ni borra datos. Es seguro repetirlo.

create table if not exists public.tienda_visitas (
  dia date primary key,
  visitas integer not null default 0,
  visitantes integer not null default 0
);

alter table public.tienda_visitas enable row level security;

-- Solo el sistema (usuarios logueados) puede leer los números. La tienda solo puede "sumar una visita".
drop policy if exists tienda_visitas_leer on public.tienda_visitas;
create policy tienda_visitas_leer on public.tienda_visitas for select to authenticated using (true);

create or replace function public.registrar_visita(p_nuevo_visitante boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  insert into public.tienda_visitas (dia, visitas, visitantes)
  values (hoy, 1, case when p_nuevo_visitante then 1 else 0 end)
  on conflict (dia) do update
    set visitas = public.tienda_visitas.visitas + 1,
        visitantes = public.tienda_visitas.visitantes + case when p_nuevo_visitante then 1 else 0 end;
end;
$$;

revoke all on function public.registrar_visita(boolean) from public;
grant execute on function public.registrar_visita(boolean) to anon, authenticated;

notify pgrst, 'reload schema';
