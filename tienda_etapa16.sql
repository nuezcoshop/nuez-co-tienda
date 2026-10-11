-- Nuez Co: mensajes de la cinta superior que se desplaza (se editan desde el POS).
-- Pegalo UNA vez en Supabase > SQL Editor > Run. No modifica ni borra datos. Es seguro repetirlo.

alter table public.tienda_config add column if not exists cinta_texto text;

notify pgrst, 'reload schema';

-- Velocidad de la cinta (1 = lenta ... 10 = rápida; vacío = normal).
alter table public.tienda_config add column if not exists cinta_velocidad smallint;

notify pgrst, 'reload schema';
