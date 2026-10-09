"""Backend-only Supabase adapter. Do not expose the service-role key to the browser."""
import json
import os
from urllib.request import Request, urlopen
from urllib.parse import quote
from uuid import uuid4
from .store import SHEETS

class SupabaseStore:
    def __init__(self):
        self.url = os.environ['SUPABASE_URL'].rstrip('/') + '/rest/v1'
        self.key = os.environ['SUPABASE_SERVICE_ROLE_KEY']

    def _request(self, path, method='GET', payload=None, headers=None):
        data = json.dumps(payload).encode() if payload is not None else None
        req = Request(self.url + path, data=data, method=method, headers={
            'apikey': self.key,
            'Authorization': 'Bearer ' + self.key,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
            **(headers or {}),
        })
        with urlopen(req, timeout=15) as response:
            raw = response.read()
            return json.loads(raw) if raw else []

    def all(self, table):
        if table not in SHEETS: raise KeyError(table)
        return [row['data'] for row in self._request('/menuflow_records?select=data&table_name=eq.' + quote(table))]

    def insert(self, table, data):
        if table not in SHEETS: raise KeyError(table)
        record = {k:data.get(k,'') for k in SHEETS[table]}
        key = 'key' if table == 'settings' else 'id'
        record[key] = record.get(key) or uuid4().hex[:10]
        self._request('/menuflow_records', 'POST', {
            'table_name':table, 'record_id':str(record[key]), 'data':record,
        })
        return record

    def update(self, table, ident, data):
        if table not in SHEETS: raise KeyError(table)
        row = next((r for r in self.all(table) if str(r.get('key' if table=='settings' else 'id'))==str(ident)),None)
        if not row: return False
        row.update({k:v for k,v in data.items() if k in SHEETS[table] and k not in ('id','key')})
        self._request('/menuflow_records?table_name=eq.' + quote(table) + '&record_id=eq.' + quote(str(ident)), 'PATCH', {'data':row})
        return True

    def delete(self, table, ident):
        if table not in SHEETS: raise KeyError(table)
        if not any(str(r.get('key' if table=='settings' else 'id'))==str(ident) for r in self.all(table)):
            return False
        self._request('/menuflow_records?table_name=eq.' + quote(table) + '&record_id=eq.' + quote(str(ident)), 'DELETE')
        return True

    def settings(self):
        return {r['key']:r['value'] for r in self.all('settings')}

    def setting(self, key, value):
        if not self.update('settings', key, {'value':str(value)}):
            self.insert('settings', {'key':key,'value':str(value)})
