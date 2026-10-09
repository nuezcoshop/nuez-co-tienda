-- Nuez Co POS: permite "eliminar" productos que ya tienen ventas o compras (se archivan: se ocultan de todas las listas
-- pero el historial, la caja y las estadísticas anteriores quedan intactos).
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No modifica ni borra datos. Es seguro repetirlo.

alter table public.productos add column if not exists archivado boolean not null default false;

notify pgrst, 'reload schema';
