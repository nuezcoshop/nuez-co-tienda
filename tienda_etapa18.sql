-- Nuez Co: pausa de la tienda + pop up de bienvenida (se editan desde el POS).
-- Es seguro repetirlo: no modifica ni borra datos.

alter table public.tienda_config add column if not exists pausa_activa boolean default false;
alter table public.tienda_config add column if not exists pausa_mensaje text;
alter table public.tienda_config add column if not exists popup_activo boolean default false;
alter table public.tienda_config add column if not exists popup_titulo text;
alter table public.tienda_config add column if not exists popup_boton text;
alter table public.tienda_config add column if not exists popup_link text;
alter table public.tienda_config add column if not exists popup_letra_chica text;
alter table public.tienda_config add column if not exists popup_hasta date;

notify pgrst, 'reload schema';
