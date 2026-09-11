-- Tabla única del día 1. Correr en Supabase → SQL Editor.
create table if not exists public.reportes (
  id                       uuid primary key default gen_random_uuid(),
  creado_en                timestamptz not null default now(),
  ticket                   text not null unique,
  sesion_id                text,
  nombre                   text not null,
  telefono                 text not null,
  calificacion_general     text,
  requiere_visita_tecnica  boolean default false,
  generado_por             text,
  sesion                   jsonb not null,
  reporte                  jsonb not null
);

create index if not exists reportes_creado_en_idx on public.reportes (creado_en desc);

-- El endpoint entra con la service_role key, que salta RLS.
-- Igual dejamos RLS prendido para que la anon key no pueda leer nada.
alter table public.reportes enable row level security;
