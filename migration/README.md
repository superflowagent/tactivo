# Migración a Supabase — Archivos de ayuda

Archivos incluidos:
- `migrate.sql` — crea las tablas necesarias.
- `seed.js` — script Node para crear datos de prueba, usuarios en Auth y subir ficheros a Storage.
- `.env.example` — ejemplo de variables de entorno.

Instrucciones rápidas:
1. Copia `.env.example` a `.env` y añade `SUPABASE_URL` y `SERVICE_ROLE_KEY` (service_role). No subas `.env` al repositorio.
2. Crea una carpeta `sample_files/` con hasta `NUM_SEED` ficheros para subir.
3. Instala dependencias: `npm init -y` y `npm install @supabase/supabase-js dotenv`.
4. Ejecuta: `node migration/seed.js`.

Seguridad:
- Rota la `service_role` key cuando termines.
- Revisa y aplica políticas RLS antes de producción.
