"""One-time migration from local Excel to Supabase; requires env vars."""
from pathlib import Path
from backend.store import ExcelStore, SHEETS
from backend.supabase_store import SupabaseStore
root = Path(__file__).resolve().parent.parent
source = ExcelStore(root / 'data' / 'cardapio.xlsx')
target = SupabaseStore()
for table in SHEETS:
    existing = {str(row.get('key' if table=='settings' else 'id')) for row in target.all(table)}
    copied = 0
    for row in source.all(table):
        ident = str(row.get('key' if table=='settings' else 'id'))
        if ident and ident not in existing:
            target.insert(table, row)
            copied += 1
    print(f'{table}: {copied} importados')
