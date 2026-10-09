-- Nuez Co: tercer color (acento) para la tienda: regla 60/30/10 (fondo / color principal / acento).
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No modifica ni borra datos. Es seguro repetirlo.

alter table public.tienda_config add column if not exists color_acento text;

notify pgrst, 'reload schema';
