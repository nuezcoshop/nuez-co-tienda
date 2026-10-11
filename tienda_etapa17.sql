-- Nuez Co: bolsa de regalo que se ofrece dentro del carrito (se activa y se elige desde el POS).
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No modifica ni borra datos. Es seguro repetirlo.

alter table public.tienda_config add column if not exists bolsa_activa boolean default false;
alter table public.tienda_config add column if not exists bolsa_producto_id uuid;
alter table public.tienda_config add column if not exists bolsa_foto text;

notify pgrst, 'reload schema';
