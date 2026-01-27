-- Migration: add self_schedule boolean column to companies
-- Created: 2026-01-27

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS self_schedule boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.companies.self_schedule IS 'Permite que los clientes se auto-programen citas según disponibilidad';
