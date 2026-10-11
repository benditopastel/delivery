-- Execute no SQL Editor do Supabase antes de implantar a Edge Function.
create table if not exists public.mf_records (
  table_name text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(table_name,id),
  constraint mf_table_allowed check(table_name in ('categories','products','addons','addon_groups','orders','banners','coupons','settings','loyalty','rewards'))
);
create index if not exists mf_records_table_date on public.mf_records(table_name,created_at);
create index if not exists mf_orders_status on public.mf_records ((data->>'status')) where table_name='orders';
create index if not exists mf_orders_coupon on public.mf_records ((data->>'coupon')) where table_name='orders';
create index if not exists mf_loyalty_phone on public.mf_records ((data->>'phone')) where table_name='loyalty';
alter table public.mf_records enable row level security;
revoke all on public.mf_records from anon, authenticated, public;
grant all on public.mf_records to service_role;

insert into public.mf_records(table_name,id,data)
select 'settings',key,jsonb_build_object('key',key,'value',value)
from (values
 ('store_name','Minha loja'),('delivery_fee','0'),('free_shipping','75'),('open','true'),
 ('notice','Bem-vindo!'),('primary','#961406'),('secondary','#d5411a'),('pix_key','')
) as defaults(key,value)
on conflict(table_name,id) do nothing;

-- Executa pedido e abatimento de estoque em UMA transação PostgreSQL.
create or replace function public.mf_commit_checkout(p_order jsonb,p_stock jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  key text;
  qty numeric;
  rec record;
  updated_stock numeric;
  order_id text;
begin
  -- Somente service_role pode executar esta RPC. Bloqueia linhas em ordem estável.
  for key in select jsonb_object_keys(p_stock) order by 1 loop
    qty := (p_stock->>key)::numeric;
    if qty <= 0 or qty <> trunc(qty) then raise exception 'Quantidade inválida'; end if;
    select * into rec from public.mf_records
      where id=key and table_name in ('products','addons')
      order by case when table_name='products' then 0 else 1 end limit 1 for update;
    if not found then raise exception 'Produto/adicional não encontrado: %',key; end if;
    if coalesce((rec.data->>'active')::boolean,false)=false then raise exception 'Item indisponível: %',key; end if;
    if coalesce((rec.data->>'stock_enabled')::boolean,false) then
      updated_stock := coalesce(nullif(rec.data->>'stock','')::numeric,0)-qty;
      if updated_stock < 0 then raise exception 'Estoque insuficiente: %',key; end if;
      update public.mf_records set data=jsonb_set(data,'{stock}',to_jsonb(updated_stock)),updated_at=now()
      where table_name=rec.table_name and id=rec.id;
    end if;
  end loop;
  order_id := substr(replace(gen_random_uuid()::text,'-',''),1,12);
  insert into public.mf_records(table_name,id,data) values ('orders',order_id,p_order||jsonb_build_object('id',order_id));
  return jsonb_build_object('id',order_id);
end;
$$;
revoke all on function public.mf_commit_checkout(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.mf_commit_checkout(jsonb,jsonb) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('menu-images','menu-images',true,4194304,ARRAY['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=true,file_size_limit=4194304,
 allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','image/gif'];
-- Upload via service_role da Edge Function; leitura pública para o catálogo.

-- Somente contas explicitamente permitidas acessam a administração.
create table if not exists public.mf_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.mf_admins enable row level security;
revoke all on public.mf_admins from anon, authenticated, public;
grant all on public.mf_admins to service_role;
-- Depois de criar seu usuário em Authentication > Users, execute no SQL Editor:
-- insert into public.mf_admins(user_id) values ('UUID_DO_SEU_USUARIO');
