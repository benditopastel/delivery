// @ts-nocheck
// MenuFlow API: Supabase Edge Function (Deno).
import {createClient} from 'npm:@supabase/supabase-js@2';
const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});

const TABLES=['categories','products','addons','addon_groups','orders','banners','coupons','settings','loyalty','rewards'];
const DEFAULTS={store_name:'Minha loja',delivery_fee:'0',free_shipping:'75',open:'true',notice:'Bem-vindo!',primary:'#961406',secondary:'#d5411a',pix_key:''};
const ACTIVE=['recebido','preparando','pronto','em entrega'];
const BUCKET='menu-images';
const cors={
 'access-control-allow-origin':'*',
 'access-control-allow-headers':'authorization, apikey, content-type, x-region, x-client-info',
 'access-control-allow-methods':'POST, OPTIONS',
 'access-control-max-age':'86400', // o navegador guarda o preflight: elimina 1 ida-e-volta por chamada
 'content-type':'application/json; charset=utf-8'};

function assert(cond,message){if(!cond)throw Error(message)}
function errDB(error){if(error)throw Error('Erro do Supabase: '+error.message)}
function scrub(record){let obj={...record};for(const k of ['active','required','stock_enabled','exclude_sale'])if(k in obj)obj[k]=obj[k]===true||String(obj[k]).toLowerCase()==='true';return obj}
function enabled(v){return v===true||String(v).toLowerCase()==='true'}
function numeric(v){let n=Number(v||0);if(!isFinite(n))throw Error('Número inválido');return n}
function ids(v){return String(v||'').split(',').map(x=>x.trim()).filter(Boolean)}

// ---------- leitura: UMA consulta para várias tabelas (antes eram uma por tabela, em sequência) ----------
async function rowsMany(tables){
 for(const t of tables)assert(TABLES.includes(t),'Tabela inválida');
 const out=Object.fromEntries(tables.map(t=>[t,[]]));let start=0;
 while(true){
  const {data,error}=await supabase.from('mf_records').select('table_name,data').in('table_name',tables)
   .order('created_at',{ascending:true}).order('id',{ascending:true}).range(start,start+999);
  errDB(error);const part=data||[];
  for(const r of part)out[r.table_name].push(scrub(r.data));
  if(part.length<1000)break;start+=1000;
 }
 return out;
}
const rows=async t=>(await rowsMany([t]))[t];
async function ordersRecent(limit=500){
 const {data,error}=await supabase.from('mf_records').select('data').eq('table_name','orders').order('created_at',{ascending:false}).limit(limit);
 errDB(error);return (data||[]).map(r=>scrub(r.data)).reverse();
}
async function ordersLive(){
 const q=(statuses,limit)=>supabase.from('mf_records').select('data').eq('table_name','orders').in('data->>status',statuses).order('created_at',{ascending:false}).limit(limit);
 const [a,b]=await Promise.all([q(ACTIVE,150),q(['concluido','cancelado'],25)]);
 errDB(a.error);errDB(b.error);
 return [...(a.data||[]),...(b.data||[])].map(r=>scrub(r.data));
}

// ---------- cache curto do catálogo público (por instância) ----------
let catalogCache=null;const CATALOG_TTL=15000;
function invalidate(){catalogCache=null}
function settingsFrom(list){let s={...DEFAULTS};for(const i of list)s[i.key]=String(i.value??'');return s}
const settings=async()=>settingsFrom(await rows('settings'));
async function publicData(){
 if(catalogCache&&catalogCache.exp>Date.now())return catalogCache.value;
 const names=['categories','products','addons','addon_groups','banners','rewards'];
 const r=await rowsMany([...names,'settings']);const out={};
 for(const t of names)out[t]=r[t].filter(x=>x.active);
 const {pix_key,...publicSettings}=settingsFrom(r.settings); // a chave Pix só é entregue no checkout
 const value={...out,coupons:[],orders:[],settings:publicSettings};
 catalogCache={value,exp:Date.now()+CATALOG_TTL};return value;
}

// ---------- escrita ----------
async function save(table,id,data,mode){
 assert(TABLES.includes(table),'Tabela inválida');assert(table!=='settings','Configuração inválida');let item=null;
 if(mode==='PATCH'||mode==='DELETE'){
  const {data:old,error}=await supabase.from('mf_records').select('data').eq('table_name',table).eq('id',String(id)).maybeSingle();
  errDB(error);assert(old,'Registro não encontrado');item=old.data;
 }
 if(mode==='DELETE'){const {error}=await supabase.from('mf_records').delete().eq('table_name',table).eq('id',String(id));errDB(error);invalidate();return {ok:true}}
 const key=mode==='PATCH'?String(id):String(id||crypto.randomUUID().slice(0,12));
 item={...(item||{}),...(data||{}),id:key};
 const {error}=await supabase.from('mf_records').upsert({table_name:table,id:key,data:item},{onConflict:'table_name,id'});
 errDB(error);invalidate();return item;
}
// reordenar: 2 consultas no total (antes: 2 por item, até 200 viagens)
async function reorder(changes){
 const byTable={};for(const ch of changes){assert(['categories','products'].includes(ch.table),'Tabela inválida');(byTable[ch.table]??=[]).push(ch)}
 const recs=[];
 for(const [table,list] of Object.entries(byTable)){
  const {data,error}=await supabase.from('mf_records').select('id,data').eq('table_name',table).in('id',list.map(c=>String(c.id)));errDB(error);
  const old=Object.fromEntries((data||[]).map(r=>[r.id,r.data]));
  for(const c of list){const k=String(c.id);if(!old[k])continue;const patch={};
   if(c.data&&'position' in c.data)patch.position=numeric(c.data.position);
   if(c.data&&'category_id' in c.data)patch.category_id=String(c.data.category_id);
   recs.push({table_name:table,id:k,data:{...old[k],...patch,id:k}})}
 }
 if(recs.length){const {error}=await supabase.from('mf_records').upsert(recs,{onConflict:'table_name,id'});errDB(error)}
 invalidate();return {ok:true};
}

// ---------- Pix ----------
function normPixKey(raw){
 let k=String(raw||'').trim();if(!k)return '';
 if(k.includes('@'))return k.toLowerCase();
 if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k))return k.toLowerCase();
 const d=k.replace(/\D/g,'');
 if(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(k)||/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(k))return d;
 if(k.startsWith('+'))return '+'+d;
 if(/[()]/.test(k))return '+55'+(d.length>11&&d.startsWith('55')?d.slice(2):d);
 return /^[\d\s.-]+$/.test(k)?d:k;
}
function pixCode(key,amount,name){
 function field(id,v){return id+String(v.length).padStart(2,'0')+v}
 function norm(s,max){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 ]/g,'').trim().slice(0,max)}
 const data=field('00','br.gov.bcb.pix')+field('01',key);
 const payload=field('00','01')+field('26',data)+field('52','0000')+field('53','986')+field('54',numeric(amount).toFixed(2))+field('58','BR')+field('59',norm(name||'LOJA',25)||'LOJA')+field('60','BRASIL')+field('62',field('05','***'))+'6304';
 let crc=0xffff;for(let i=0;i<payload.length;i++){crc^=payload.charCodeAt(i)<<8;for(let b=0;b<8;b++)crc=crc&0x8000?(crc<<1^0x1021)&65535:crc<<1&65535}
 return payload+crc.toString(16).toUpperCase().padStart(4,'0');
}
async function updateSettings(data){
 const recs=[];
 for(const [key,value] of Object.entries(data||{})){
  if(!(key in DEFAULTS))continue;
  let v=String(value??'');if(key==='pix_key'){v=normPixKey(v);assert(v.length<=77,'Chave Pix inválida')}
  recs.push({table_name:'settings',id:key,data:{key,value:v}});
 }
 if(recs.length){const {error}=await supabase.from('mf_records').upsert(recs,{onConflict:'table_name,id'});errDB(error)}
 invalidate();return settings();
}

// ---------- autenticação do admin (com cache de 60 s por instância) ----------
const okCache=new Map();
async function authorized(token){
 assert(typeof token==='string'&&token.length>30,'Faça login para acessar o painel');
 if((okCache.get(token)||0)>Date.now())return;
 const {data:{user},error}=await supabase.auth.getUser(token);
 assert(!error&&user?.id,'Sessão inválida ou expirada');
 const {data:allowed,error:dbError}=await supabase.from('mf_admins').select('user_id').eq('user_id',user.id).maybeSingle();
 errDB(dbError);assert(!!allowed,'Usuário sem permissão administrativa');
 if(okCache.size>50)okCache.clear();okCache.set(token,Date.now()+60000);
}

// ---------- imagens ----------
let bucketReady=false;
async function ensureBucket(){
 if(bucketReady)return;
 const {data}=await supabase.storage.getBucket(BUCKET);
 if(!data){
  const {error}=await supabase.storage.createBucket(BUCKET,{public:true,fileSizeLimit:4194304,allowedMimeTypes:['image/jpeg','image/png','image/webp','image/gif']});
  if(error&&!/exist/i.test(error.message))throw Error('Não foi possível criar o armazenamento de imagens: '+error.message);
 }else if(!data.public){await supabase.storage.updateBucket(BUCKET,{public:true,fileSizeLimit:4194304,allowedMimeTypes:['image/jpeg','image/png','image/webp','image/gif']})}
 bucketReady=true;
}
function toBytes(b64,max){
 assert(typeof b64==='string'&&b64.length>0&&b64.length<max*1.4,'Imagem acima do limite');
 const bin=atob(b64),buf=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);
 assert(buf.length<=max,'Imagem acima do limite');return buf;
}
async function upload(p){
 assert(/^image\/(jpeg|png|webp|gif)$/.test(String(p.mime||'')),'Formato de imagem inválido');
 await ensureBucket();
 const ext=p.mime.split('/')[1],path=crypto.randomUUID().replace(/-/g,'')+'.'+ext,store=supabase.storage.from(BUCKET);
 const opts={contentType:p.mime,upsert:false,cacheControl:'31536000'};
 const jobs=[store.upload(path,toBytes(p.base64,4*1024*1024),opts)];
 if(p.thumb_base64)jobs.push(store.upload('thumb_'+path,toBytes(p.thumb_base64,1024*1024),opts));
 for(const r of await Promise.all(jobs))errDB(r.error);
 const pub=n=>store.getPublicUrl(n).data.publicUrl;
 return {url:pub(path),thumbnail:p.thumb_base64?pub('thumb_'+path):pub(path)};
}

// ---------- checkout ----------
async function commitCheckout(order,used){const {data,error}=await supabase.rpc('mf_commit_checkout',{p_order:order,p_stock:used});errDB(error);return data}
async function checkout(p){
 const r=await rowsMany(['settings','products','addons','addon_groups','categories']); // 1 consulta
 const cfg=settingsFrom(r.settings);if(cfg.open!=='true')throw Error('Loja fechada');
 const name=String(p.customer||'').trim(),phone=String(p.phone||'').replace(/\D/g,'');
 if(name.length<2||phone.length<10)throw Error('Informe nome e telefone');
 if(!Array.isArray(p.items)||!p.items.length||p.items.length>60)throw Error('Carrinho inválido');
 const delivery=p.delivery==='entrega'?'entrega':'retirada';
 if(delivery==='entrega'&&!String(p.address||'').trim())throw Error('Endereço obrigatório');
 const payment=['pix','cartao','dinheiro'].includes(p.payment)?p.payment:'pix';
 const byId=l=>Object.fromEntries(l.map(x=>[x.id,x]));
 const products=byId(r.products),addons=byId(r.addons),groups=byId(r.addon_groups),categories=byId(r.categories);
 let normalized=[],used={},subtotal=0;
 for(let line of p.items){
  let prod=products[line.id],qty=Number(line.qty);
  if(!prod||!enabled(prod.active)||!Number.isInteger(qty)||qty<1||qty>30)throw Error('Produto indisponível ou quantidade inválida');
  used[prod.id]=(used[prod.id]||0)+qty;let extra=0,options=[];
  for(let aid of [...new Set(line.addons||[])]){
   let a=addons[aid];if(!a||!enabled(a.active)||!ids(prod.addons).includes(aid))throw Error('Adicional indisponível');
   used[aid]=(used[aid]||0)+qty;let price=numeric(a.price);if(price<0)throw Error('Preço inválido');extra+=price;options.push({id:aid,name:a.name,price});
  }
  let allowed=[...new Set([...ids(prod.group_ids),...ids(categories[prod.category_id]?.group_ids)])],choice=line.choices||{};
  if(Object.keys(choice).some(id=>!allowed.includes(id)))throw Error('Grupo não pertence ao produto');
  for(let gid of allowed){
   let g=groups[gid];if(!g||!enabled(g.active))continue;
   let opts=JSON.parse(g.options||'[]'),selected=choice[gid]||[],counts={};
   if(!Array.isArray(selected))throw Error('Escolhas inválidas');
   for(let v of selected){let id=typeof v==='string'?v:v.id,units=typeof v==='string'?1:Number(v.qty);if(!id||!Number.isInteger(units)||units<1||units>30||counts[id])throw Error('Escolha duplicada/inválida');counts[id]=units}
   let amount=Object.values(counts).reduce((a,b)=>a+b,0),min=Math.max(numeric(g.min_select),enabled(g.required)?1:0),max=numeric(g.max_select)||opts.length;
   if(amount<min||amount>max)throw Error('Confira quantidades em '+g.name);
   for(let [id,units] of Object.entries(counts)){
    let opt=opts.find(x=>x.id===id);if(!opt||opt.active===false)throw Error('Opção indisponível');
    let linked=opt.product_id?products[opt.product_id]:null;if(opt.product_id&&(!linked||!enabled(linked.active)))throw Error('Produto vinculado indisponível');
    let val=opt.price!==''&&opt.price!==null&&opt.price!==undefined?numeric(opt.price):linked?numeric(linked.sale_price||linked.price):0;if(val<0)throw Error('Preço inválido');
    if(linked)used[linked.id]=(used[linked.id]||0)+qty*units;extra+=val*units;options.push({id,group:g.name,name:opt.name||linked?.name||'',price:val,qty:units});
   }
  }
  let price=numeric(prod.sale_price||prod.price);if(price<0)throw Error('Preço inválido');
  subtotal+=qty*(price+extra);
  normalized.push({id:prod.id,name:prod.name,qty,price,addons:options,obs:String(line.obs||'').trim().slice(0,200)});
 }
 for(let [id,count] of Object.entries(used)){let v=products[id]||addons[id];if(enabled(v.stock_enabled)&&numeric(v.stock)<count)throw Error('Estoque insuficiente: '+v.name)}
 let fee=delivery==='entrega'?numeric(cfg.delivery_fee):0;if(delivery==='entrega'&&subtotal>=numeric(cfg.free_shipping||999999))fee=0;
 let discount=0,code=String(p.coupon||'').trim().toUpperCase();
 if(code){
  const [coupons,prev]=await Promise.all([rows('coupons'),supabase.from('mf_records').select('data').eq('table_name','orders').eq('data->>coupon',code)]);
  errDB(prev.error);
  let cup=coupons.find(c=>String(c.code).toUpperCase()===code&&enabled(c.active));if(!cup)throw Error('Cupom inválido');
  let now=new Date().toISOString();
  if(cup.starts_at&&now<String(cup.starts_at).replace(' ','T'))throw Error('Cupom ainda não começou');
  if(cup.ends_at&&now>String(cup.ends_at).replace(' ','T'))throw Error('Cupom expirado');
  let previous=(prev.data||[]).map(x=>x.data).filter(x=>x.status!=='cancelado');
  if(numeric(cup.usage_limit)>0&&previous.length>=numeric(cup.usage_limit))throw Error('Cupom esgotado');
  if(numeric(cup.per_phone_limit)>0&&previous.filter(x=>String(x.phone)===phone).length>=numeric(cup.per_phone_limit))throw Error('Limite de uso por cliente');
  let ip=ids(cup.include_products),ep=ids(cup.exclude_products),ic=ids(cup.include_categories),ec=ids(cup.exclude_categories),eligible=0;
  for(let item of normalized){
   let product=products[item.id],cat=product.category_id;
   if(ip.length&&!ip.includes(item.id)||ep.includes(item.id)||ic.length&&!ic.includes(cat)||ec.includes(cat)||enabled(cup.exclude_sale)&&numeric(product.sale_price)>0)continue;
   eligible+=item.qty*(item.price+item.addons.reduce((a,b)=>a+numeric(b.price)*(b.qty||1),0));
  }
  if(eligible<=0||subtotal<numeric(cup.min_total))throw Error('Cupom não aplicável');
  discount=Math.min(eligible,cup.type==='fixed'?numeric(cup.value):eligible*numeric(cup.value)/100);
  if(numeric(cup.max_discount)>0)discount=Math.min(discount,numeric(cup.max_discount));
 }
 let total=Math.round((subtotal+fee-discount)*100)/100;
 let changeFor=payment==='dinheiro'?numeric(p.change_for):0;
 if(changeFor>0&&changeFor<total)throw Error('O valor para troco precisa ser maior ou igual ao total do pedido');
 let orderInput={customer:name,phone,delivery,address:String(p.address||''),payment,items:JSON.stringify(normalized),subtotal:Math.round(subtotal*100)/100,fee,discount,total,status:'recebido',created_at:new Date().toISOString(),change_for:changeFor,change_amount:changeFor>0?Math.round((changeFor-total)*100)/100:0,coupon:code,notes:String(p.notes||'').trim().slice(0,300)};
 const order=await commitCheckout(orderInput,used);invalidate();
 const key=normPixKey(cfg.pix_key),isPix=payment==='pix';
 return {id:order.id,total,status:'recebido',payment,change_for:changeFor,change_amount:orderInput.change_amount,
  pix_key:isPix&&key?key:null,pix_missing:isPix&&!key,
  pix_copy_paste:isPix&&key?pixCode(key,total,cfg.store_name):null};
}

// ---------- pedidos ----------
async function statusUpdate(p){
 const valid=['recebido','preparando','pronto','em entrega','concluido','cancelado'];if(!valid.includes(p.status))throw Error('Status inválido');
 const {data:row,error}=await supabase.from('mf_records').select('data').eq('table_name','orders').eq('id',String(p.id)).maybeSingle();errDB(error);
 const o=row?.data;if(!o)throw Error('Pedido não encontrado');
 if(o.status==='concluido'&&p.status!=='concluido')throw Error('Pedido concluído');
 if(o.status==='cancelado'&&p.status!=='cancelado')throw Error('Pedido cancelado');
 {const {error}=await supabase.from('mf_records').upsert({table_name:'orders',id:String(p.id),data:{...o,status:p.status}},{onConflict:'table_name,id'});errDB(error)}
 if(p.status==='concluido'&&o.status!=='concluido'){
  const pts=Math.max(0,Math.floor(numeric(o.subtotal)-numeric(o.discount)));
  const {data:ly,error:e2}=await supabase.from('mf_records').select('id,data').eq('table_name','loyalty').eq('data->>phone',String(o.phone)).limit(1);errDB(e2);
  if(ly&&ly[0])await save('loyalty',ly[0].id,{points:numeric(ly[0].data.points)+pts},'PATCH');
  else await save('loyalty','',{phone:o.phone,points:pts},'POST');
 }
 return {ok:true,status:p.status};
}

async function dispatch(action,p,secret){
 if(action==='ping')return {status:'ok',provider:'Supabase',time:new Date().toISOString()};
 if(action==='catalog')return publicData();
 if(action==='checkout')return checkout(p);
 await authorized(secret);
 if(action==='whoami')return {ok:true};
 if(action==='bootstrap'){
  const [r,orders]=await Promise.all([rowsMany(['categories','products','addons','addon_groups','banners','coupons','rewards','settings']),ordersRecent(500)]);
  const {settings:s,...rest}=r;return {...rest,orders,settings:settingsFrom(s)};
 }
 if(action==='orders_live')return ordersLive();
 if(action==='settings')return updateSettings(p);
 if(action==='manage'){
  assert(['products','categories','addons','addon_groups','banners','coupons','rewards'].includes(p.table),'Tabela inválida');
  assert(['POST','PATCH','DELETE'].includes(p.method),'Método inválido');
  if(['products','addons'].includes(p.table)&&Number(p.data?.price||0)<0)throw Error('Preço inválido');
  return save(p.table,p.id,p.data,p.method);
 }
 if(action==='reorder'){assert(Array.isArray(p.changes)&&p.changes.length<=100,'Reordenação inválida');return reorder(p.changes)}
 if(action==='order_status')return statusUpdate(p);
 if(action==='upload')return upload(p);
 throw Error('Ação não permitida');
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors,status:204});
 if(req.method!=='POST')return new Response(JSON.stringify({ok:false,error:'Método inválido'}),{status:405,headers:cors});
 try{
  const body=await req.json();
  assert(body&&typeof body.action==='string'&&body.data!==null&&typeof body.data==='object'&&!Array.isArray(body.data),'Requisição inválida');
  const result=await dispatch(body.action,body.data,(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,''));
  return new Response(JSON.stringify({ok:true,data:result}),{status:200,headers:cors});
 }catch(e){
  const msg=String(e?.message||e);
  return new Response(JSON.stringify({ok:false,error:msg}),{status:/login|permissão|Sessão/.test(msg)?401:400,headers:cors});
 }
});
