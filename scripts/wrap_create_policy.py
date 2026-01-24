import re
from pathlib import Path
p = Path('supabase/migrations/20260123122028_20260123120000_remote_schema.sql.sql')
s = p.read_text()
pattern = re.compile(r'(create policy \"(?P<polname>[^\"]+)\"\s+ON\s+\"public\"\.\"(?P<table>[^\"]+)\"\s+AS[\s\S]*?)(?=\n\n|$)', re.IGNORECASE)
changed = False
new = s
for m in list(pattern.finditer(s)):
    full = m.group(1)
    name = m.group('polname')
    table = m.group('table')
    # build wrapped
    wrapped = f"DO $$\nBEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = '{name}' AND n.nspname = 'public' AND c.relname = '{table}') THEN\n    {full.strip()}\n  END IF;\nEND\n$$;"
    new = new.replace(full, wrapped)
    changed = True
if changed:
    b = p.with_suffix('.sql.policywrap.bak')
    b.write_text(s)
    p.write_text(new)
    print('Wrapped policies and created backup', b)
else:
    print('No changes needed')
