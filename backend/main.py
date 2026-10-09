from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
from PIL import Image,ImageOps
from io import BytesIO
from uuid import uuid4
from datetime import datetime
import json,math,os,unicodedata
from .store import ExcelStore,SHEETS

ROOT=Path(__file__).resolve().parent.parent
# Set STORAGE_BACKEND=supabase only after creating the schema and migrating data.
if os.environ.get('STORAGE_BACKEND', os.environ.get('DATABASE_PROVIDER', 'excel')).lower() == 'supabase':
 from .supabase_store import SupabaseStore
 store = SupabaseStore()
else:
 store = ExcelStore(ROOT/'data'/'cardapio.xlsx')
app=FastAPI(title='Cardápio Digital — Protótipo')
app.mount('/assets',StaticFiles(directory=ROOT/'frontend'),name='assets')
app.mount('/uploads',StaticFiles(directory=ROOT/'uploads'),name='uploads')

@app.get('/')
def customer():return FileResponse(ROOT/'frontend'/'index.html')
@app.get('/admin')
def admin():return FileResponse(ROOT/'frontend'/'admin.html')
@app.get('/pedidos')
def order_page():return FileResponse(ROOT/'frontend'/'orders.html')
@app.get('/api/bootstrap')
def bootstrap():return {**{k:store.all(k) for k in ['categories','products','addons','addon_groups','banners','coupons','orders','rewards']},'settings':store.settings()}
@app.get('/api/{table}')
def get_table(table:str):
 if table not in SHEETS:raise HTTPException(404,'Tabela inválida')
 return store.all(table)
@app.post('/api/manage/{table}')
async def create(table:str,request:Request):
 if table not in ['categories','products','addons','addon_groups','banners','coupons','rewards']:raise HTTPException(404,'Não permitido')
 payload=await request.json()
 if table in ['products','addons']:
  try:
   if float(payload.get('price',0))<0:raise ValueError()
  except:raise HTTPException(400,'Preço inválido')
 return store.insert(table,payload)
@app.patch('/api/manage/{table}/{ident}')
async def edit(table:str,ident:str,request:Request):
 if table not in ['categories','products','addons','addon_groups','banners','coupons','rewards']:raise HTTPException(404,'Não permitido')
 payload=await request.json()
 if not store.update(table,ident,payload):raise HTTPException(404,'Não encontrado')
 return {'ok':True}
@app.delete('/api/manage/{table}/{ident}')
def delete(table:str,ident:str):
 if table not in ['categories','products','addons','addon_groups','banners','coupons','rewards']:raise HTTPException(404,'Não permitido')
 if not store.delete(table,ident):raise HTTPException(404,'Não encontrado')
 return {'ok':True}
@app.post('/api/reorder')
async def reorder(request:Request):
 changes=(await request.json()).get('changes',[])
 if not isinstance(changes,list) or len(changes)>100:raise HTTPException(400,'Reordenação inválida')
 for change in changes:
  if change.get('table') not in ['categories','products'] or not change.get('id'):raise HTTPException(400,'Registro inválido')
  if not store.update(change['table'],change['id'],change.get('data',{})):raise HTTPException(404,'Registro não encontrado')
 return {'ok':True}
@app.patch('/api/settings')
async def settings(request:Request):
 payload=await request.json()
 for k,v in payload.items():store.setting(k,v)
 return store.settings()
@app.post('/api/upload')
async def upload(file:UploadFile=File(...)):
 raw=await file.read()
 if len(raw)>10*1024*1024:raise HTTPException(413,'Imagem acima de 10 MB')
 try:
  im=Image.open(BytesIO(raw));im.verify();im=Image.open(BytesIO(raw))
  if im.format not in ['JPEG','PNG','WEBP','GIF','BMP','TIFF']:raise ValueError()
  im=ImageOps.exif_transpose(im).convert('RGB');im.thumbnail((1600,1600))
  name=uuid4().hex+'.webp';im.save(ROOT/'uploads'/name,'WEBP',quality=82,method=6)
  thumb=ImageOps.contain(im,(420,420));thumb.save(ROOT/'uploads'/('thumb_'+name),'WEBP',quality=75,method=6)
 except Exception:raise HTTPException(400,'Arquivo de imagem inválido')
 return {'url':'/uploads/'+name,'thumbnail':'/uploads/thumb_'+name}
def pix_emv(key,amount,merchant='BENDITO PASTEL',city='BRASIL'):
 """Static-key Pix BR Code with order amount. Not a payment confirmation."""
 def field(tag,value):return f'{tag}{len(value):02d}{value}'
 def clean(value,maxlen):
  value=unicodedata.normalize('NFKD',value).encode('ascii','ignore').decode().upper()
  return ''.join(c for c in value if c.isalnum() or c in ' .-')[:maxlen]
 account=field('00','br.gov.bcb.pix')+field('01',key)
 payload=field('00','01')+field('26',account)+field('52','0000')+field('53','986')+field('54',f'{amount:.2f}')+field('58','BR')+field('59',clean(merchant,25))+field('60',clean(city,15))+field('62',field('05','***'))+'6304'
 crc=0xffff
 for b in payload.encode('utf-8'):
  crc^=b<<8
  for _ in range(8):crc=((crc<<1)^0x1021) & 0xffff if crc&0x8000 else (crc<<1)&0xffff
 return payload+f'{crc:04X}'

@app.get('/api/orders/live')
def orders_live():
 return store.all('orders')

@app.post('/api/checkout')
async def checkout(request:Request):
 data=await request.json()
 products={p['id']:p for p in store.all('products')};addons={a['id']:a for a in store.all('addons')}
 if not data.get('customer') or not data.get('phone') or not data.get('items'):raise HTTPException(400,'Preencha seus dados e escolha itens')
 if str(store.settings().get('open','true')).lower()!='true':raise HTTPException(400,'Loja fechada')
 if data.get('delivery')=='entrega' and not data.get('address'):raise HTTPException(400,'Endereço obrigatório')
 subtotal=0;normalized=[]
 for line in data['items']:
  p=products.get(line.get('id'))
  if not p or not p['active'] or (p['stock_enabled'] and int(p['stock'] or 0)<int(line.get('qty',1))):raise HTTPException(400,'Produto indisponível')
  qty=int(line.get('qty',1))
  if qty<1 or qty>30:raise HTTPException(400,'Quantidade inválida')
  add=[];extra=0
  for aid in set(line.get('addons',[])):
   a=addons.get(aid)
   if not a or not a['active'] or aid not in str(p.get('addons') or '').split(',') or (a['stock_enabled'] and int(a['stock'] or 0)<qty):raise HTTPException(400,'Adicional indisponível')
   extra+=float(a['price'] or 0);add.append({'id':aid,'name':a['name'],'price':float(a['price'] or 0)})
  groups={g['id']:g for g in store.all('addon_groups')}
  selected=line.get('choices') or {}
  if not isinstance(selected,dict):raise HTTPException(400,'Seleções inválidas')
  category_row=next((c for c in store.all('categories') if c['id']==p.get('category_id')),None)
  allowed_ids=list(dict.fromkeys([x for x in (str(p.get('group_ids') or '')+','+str((category_row or {}).get('group_ids') or '')).split(',') if x]))
  if any(gid not in allowed_ids for gid in selected):raise HTTPException(400,'Grupo não pertence ao produto')
  for gid in allowed_ids:
   g=groups.get(gid)
   if not g or not g.get('active'):continue
   try:opts=json.loads(g.get('options') or '[]')
   except:raise HTTPException(400,'Configuração de grupo inválida')
   raw=selected.get(gid,[])
   if not isinstance(raw,list):raise HTTPException(400,'Seleção inválida')
   counts={}
   for entry in raw:
    oid=entry if isinstance(entry,str) else entry.get('id') if isinstance(entry,dict) else None
    units=1 if isinstance(entry,str) else entry.get('qty') if isinstance(entry,dict) else None
    if not isinstance(oid,str) or not isinstance(units,int) or isinstance(units,bool) or units<1 or units>30:raise HTTPException(400,'Quantidade de complemento inválida')
    if oid in counts:raise HTTPException(400,'Opção duplicada')
    counts[oid]=units
   minimum=max(int(g.get('min_select') or 0),1 if g.get('required') else 0)
   maximum=int(g.get('max_select') or len(opts))
   total_units=sum(counts.values())
   if not minimum<=total_units<=maximum:raise HTTPException(400,'Confira quantidades em '+str(g['name']))
   for oid,units in counts.items():
    opt=next((o for o in opts if o.get('id')==oid),None)
    if not opt or not opt.get('active',True):raise HTTPException(400,'Opção indisponível')
    linked=products.get(opt.get('product_id')) if opt.get('product_id') else None
    if opt.get('product_id') and (not linked or not linked.get('active') or (linked.get('stock_enabled') and int(linked.get('stock') or 0)<qty*units)):raise HTTPException(400,'Produto vinculado indisponível')
    amount=float(opt['price']) if opt.get('price') is not None and opt.get('price')!='' else (float(linked.get('sale_price') or linked['price']) if linked else 0)
    if not math.isfinite(amount) or amount<0:raise HTTPException(400,'Valor de opção inválido')
    extra+=amount*units;add.append({'id':oid,'group':g['name'],'name':opt.get('name') or (linked['name'] if linked else ''),'price':amount,'qty':units})
  price=float(p.get('sale_price') or p['price'])
  subtotal+=qty*(price+extra)
  normalized.append({'id':p['id'],'name':p['name'],'qty':qty,'price':price,'addons':add})
 s=store.settings();fee=float(s.get('delivery_fee') or 0) if data.get('delivery')=='entrega' else 0
 if data.get('delivery')=='entrega' and subtotal>=float(s.get('free_shipping') or 999999):fee=0
 discount=0
 code=str(data.get('coupon') or '').upper().strip()
 if code:
  cup=next((c for c in store.all('coupons') if str(c['code']).upper()==code and c['active']),None)
  if not cup:raise HTTPException(400,'Cupom inválido')
  now=datetime.now().isoformat(timespec='seconds')
  if cup.get('starts_at') and now<str(cup['starts_at']).replace(' ','T'):raise HTTPException(400,'Cupom ainda não começou')
  if cup.get('ends_at') and now>str(cup['ends_at']).replace(' ','T'):raise HTTPException(400,'Cupom expirado')
  previous=[o for o in store.all('orders') if str(o.get('coupon') or '').upper()==code and o.get('status')!='cancelado']
  # Older orders may not have a coupon column: new orders persist it below.
  if int(cup.get('usage_limit') or 0)>0 and len(previous)>=int(cup['usage_limit']):raise HTTPException(400,'Cupom esgotado')
  if int(cup.get('per_phone_limit') or 0)>0 and sum(str(o.get('phone'))==str(data['phone']) for o in previous)>=int(cup['per_phone_limit']):raise HTTPException(400,'Limite do cupom por cliente atingido')
  def ids(value):return {x.strip() for x in str(value or '').split(',') if x.strip()}
  ip,ep=ids(cup.get('include_products')),ids(cup.get('exclude_products'))
  ic,ec=ids(cup.get('include_categories')),ids(cup.get('exclude_categories'))
  eligible=0
  for item in normalized:
   product=products[item['id']];cat=product.get('category_id')
   if (ip and item['id'] not in ip) or item['id'] in ep or (ic and cat not in ic) or cat in ec:continue
   if str(cup.get('exclude_sale') or '').lower() in ('true','1','yes') and float(product.get('sale_price') or 0)>0:continue
   eligible+=item['qty']*(item['price']+sum(float(a['price'])*int(a.get('qty',1)) for a in item['addons']))
  if eligible<=0 or subtotal<float(cup.get('min_total') or 0):raise HTTPException(400,'Cupom não aplicável aos itens ou valor mínimo')
  discount=min(eligible,float(cup['value']) if cup['type']=='fixed' else eligible*float(cup['value'])/100)
  if float(cup.get('max_discount') or 0)>0:discount=min(discount,float(cup['max_discount']))
 total=round(subtotal+fee-discount,2)
 if data.get('payment')=='dinheiro' and float(data.get('change_for') or 0) and float(data['change_for'])<total:raise HTTPException(400,'Troco para valor menor que o total')
 order=store.insert('orders',{'customer':data['customer'],'phone':data['phone'],'delivery':data.get('delivery'),'address':data.get('address',''),'payment':data.get('payment','pix'),'items':json.dumps(normalized,ensure_ascii=False),'subtotal':round(subtotal,2),'fee':fee,'discount':round(discount,2),'total':total,'status':'recebido','created_at':datetime.now().isoformat(timespec='seconds'),'coupon':code,'change_for':float(data.get('change_for') or 0) if data.get('payment')=='dinheiro' else 0,'change_amount':round(max(0,float(data.get('change_for') or 0)-total),2) if data.get('payment')=='dinheiro' else 0})
 return {'id':order['id'],'total':total,'status':'recebido','pix_key':str(s.get('pix_key') or 'benditopastelcm@gmail.com') if data.get('payment')=='pix' else None,'pix_copy_paste':pix_emv(str(s.get('pix_key') or 'benditopastelcm@gmail.com'),total,str(s.get('store_name') or 'BENDITO PASTEL')) if data.get('payment')=='pix' else None}
@app.patch('/api/orders/{ident}')
async def order_status(ident:str,request:Request):
 status=(await request.json()).get('status')
 if status not in ['recebido','preparando','pronto','em entrega','concluido','cancelado']:raise HTTPException(400,'Status inválido')
 order=next((o for o in store.all('orders') if str(o['id'])==ident),None)
 if not order:raise HTTPException(404,'Pedido não encontrado')
 if order.get('status')=='concluido' and status!='concluido':raise HTTPException(400,'Pedido concluído não pode voltar de status')
 if not store.update('orders',ident,{'status':status}):raise HTTPException(404,'Pedido não encontrado')
 if status=='concluido' and order.get('status')!='concluido':
  # 1 ponto por real de produtos pagos (sem frete, após desconto).
  points=max(0,int(max(0,float(order.get('subtotal') or 0)-float(order.get('discount') or 0))))
  phone=str(order.get('phone') or '').strip()
  account=next((x for x in store.all('loyalty') if str(x.get('phone'))==phone),None)
  if account:store.update('loyalty',account['id'],{'points':int(account.get('points') or 0)+points})
  else:store.insert('loyalty',{'phone':phone,'points':points})
 return {'ok':True}


@app.get('/api/loyalty/catalog')
def loyalty_catalog():
 """Public catalog only. Balance requires authenticated customer access in production."""
 return [r for r in store.all('rewards') if r.get('active')]

@app.post('/api/loyalty/redeem')
async def loyalty_redeem(request:Request):
 """Disabled until phone verification and atomic balance deductions are implemented."""
 raise HTTPException(501,'Resgate indisponível: é necessária autenticação do cliente e transação atômica.')
