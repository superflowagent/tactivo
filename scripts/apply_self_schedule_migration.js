const { Client } = require('pg');
(async () => {
    const c = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
    try {
        await c.connect();
        await c.query("ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS self_schedule boolean NOT NULL DEFAULT false;");
        await c.query("COMMENT ON COLUMN public.companies.self_schedule IS 'Permite que los clientes se auto-programen citas según disponibilidad';");
        console.log('Migration applied');
    } catch (e) {
        console.error('Error applying migration', e);
        process.exit(1);
    } finally {
        await c.end();
    }
})();
