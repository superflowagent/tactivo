# Migración a Supabase (pre-migración checkpoint)

Contenido:
- `migrate.sql` — SQL para crear tablas principales (companies, profiles, anatomy, equipment, exercises, classes_template, events, user_cards)
- `seed.js` — Script Node (ESM) para crear datos de prueba y subir archivos a Storage

Importante (seguridad):
- NO pegues tu `SERVICE_ROLE_KEY` en chats públicos.
- Crea un archivo `.env` local con `SUPABASE_URL` y `SERVICE_ROLE_KEY` y asegúrate de rotar la key al terminar.

Ejecutar (resumen):
1. Crea `.env` con variables (usa `.env.example`).
2. Coloca hasta N archivos en `migration/sample_files/` para subirlos al bucket.
3. `npm init -y && npm install @supabase/supabase-js dotenv`
4. `node migration/seed.js`

Limpieza:
- Rota la `service_role` key después de ejecutar. Revisa las políticas RLS antes de mover a producción.

Notas:
- `seed.js` crea usuarios en Auth con contraseñas aleatorias y crea registros en `profiles` para cada usuario.
- Ajusta `NUM_SEED` en `.env` si quieres más o menos registros.
