import re
from pathlib import Path
p = Path('supabase/migrations/20260122180000_baseline.sql')
s = p.read_text()
pattern = re.compile(r'(DO \$\$\s*BEGIN\s*(.*?)\s*END\s*\$\$;)', re.DOTALL)
changed = False

def has_if_exists(inner, table):
    return f"table_schema='public' AND table_name = '{table}'" in inner

new_s = s
for m in pattern.finditer(s):
    full = m.group(1)
    inner = m.group(2)
    # handle CREATE POLICY blocks
    if 'CREATE POLICY' in inner and 'ON "public"' in inner:
        mo = re.search(r'ON\s+"public"\."(\w+)"', inner)
        if not mo:
            continue
        table = mo.group(1)
        if has_if_exists(inner, table):
            continue
        wrapped = '  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=\'public\' AND table_name = \'' + table + "') THEN\n" + inner + "\n  END IF;"
        new_full = 'DO $$\nBEGIN\n' + wrapped + '\nEND\n$$;'
        new_s = new_s.replace(full, new_full)
        changed = True
        continue
    # handle CREATE TRIGGER blocks
    if 'CREATE TRIGGER' in inner and 'ON public.' in inner:
        mo = re.search(r'ON\s+public\.(\w+)', inner)
        if not mo:
            continue
        table = mo.group(1)
        if has_if_exists(inner, table):
            continue
        wrapped = '  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=\'public\' AND table_name = \'' + table + "') THEN\n" + inner + "\n  END IF;"
        new_full = 'DO $$\nBEGIN\n' + wrapped + '\nEND\n$$;'
        new_s = new_s.replace(full, new_full)
        changed = True

if changed:
    backup = p.with_suffix('.sql.bak')
    backup.write_text(s)
    p.write_text(new_s)
    print('Wrapped policy and trigger DO blocks and created backup at', backup)
else:
    print('No changes needed')
