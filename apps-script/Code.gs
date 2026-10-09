/** MenuFlow — Google Apps Script (V8). Deploy: web app / Executar como: eu / Acesso: qualquer pessoa. */
const DB = { categories:['id','name','position','active'], products:['id','name','description','price','category_id','image','active','position','stock'], orders:['id','created_at','customer','phone','delivery','address','payment','notes','items','total','status'], settings:['key','value'] };
const LOCK_SECONDS = 25;
function setup() {
  const p=PropertiesService.getScriptProperties();
  const spreadsheetId=p.getProperty('SPREADSHEET_ID');
  if(!spreadsheetId) throw Error('Defina SPREADSHEET_ID nas propriedades do script.');
  const ss=SpreadsheetApp.openById(spreadsheetId);
  Object.keys(DB).forEach(k=>{let sh=ss.getSheetByName(k)||ss.insertSheet(k);if(sh.getLastRow()===0)sh.appendRow(DB[k]);sh.setFrozenRows(1)});
  const sheet=ss.getSheetByName('settings');
  if(sheet.getLastRow()===1) [['store_name','Bendito Pastel'],['open','true'],['whatsapp',''],['delivery_fee','0'],['pix_key','']].forEach(r=>sheet.appendRow(r));
  const dir=p.getProperty('DRIVE_FOLDER_ID');if(!dir)throw Error('Defina DRIVE_FOLDER_ID nas propriedades do script.');DriveApp.getFolderById(dir);
  if(!p.getProperty('ADMIN_PASSWORD'))throw Error('Defina ADMIN_PASSWORD nas propriedades do script.');
  return 'Estrutura criada com sucesso';
}
function props(){return PropertiesService.getScriptProperties()}
function sheet(table){if(!DB[table])throw Error('Tabela inválida');let id=props().getProperty('SPREADSHEET_ID');if(!id)throw Error('SPREADSHEET_ID não configurado');let sh=SpreadsheetApp.openById(id).getSheetByName(table);if(!sh)throw Error('Execute setup() antes de usar');return sh}
function rows(table){let sh=sheet(table),v=sh.getDataRange().getValues();if(v.length<2)return [];let headers=v[0];return v.slice(1).filter(r=>r[0]!==''&&r[0]!==null).map(r=>Object.fromEntries(headers.map((key,i)=>[key,r[i] instanceof Date?r[i].toISOString():r[i]])))}
function serialize(table,record){return DB[table].map(key=>{let v=record[key]??'';return typeof v==='string'&&/^[=+@\-\t\r]/.test(v)?"'"+v:v})}
function append(table,obj){sheet(table).appendRow(serialize(table,obj));return obj}
function edit(table,id,data){let sh=sheet(table),v=sh.getDataRange().getValues(),index=v.findIndex((r,i)=>i>0&&String(r[0])===String(id));if(index<0)throw Error('Registro não encontrado');let old=Object.fromEntries(DB[table].map((k,i)=>[k,v[index][i]])),item={...old,...data,id:old.id};sh.getRange(index+1,1,1,DB[table].length).setValues([serialize(table,item)]);return item}
function remove(table,id){let sh=sheet(table),v=sh.getDataRange().getValues(),index=v.findIndex((r,i)=>i>0&&String(r[0])===String(id));if(index<0)throw Error('Registro não encontrado');sh.deleteRow(index+1);return {id}}
function settings(){return Object.fromEntries(rows('settings').map(r=>[r.key,String(r.value)]))}
function publicData(){return {categories:rows('categories').filter(r=>String(r.active)!=='false').sort(sortPos),products:rows('products').filter(r=>String(r.active)!=='false').sort(sortPos),settings:settings()}}
function sortPos(a,b){return Number(a.position||0)-Number(b.position||0)}
function response(ok,data,error){return {ok:!!ok,data:data??null,error:error?String(error.message||error):undefined}}
function doGet(e){let action=String(e.parameter.action||'catalog'), callback=String(e.parameter.callback||'');let out;
  try{if(action!=='catalog')throw Error('Consulta pública indisponível');out=response(true,publicData())}catch(err){out=response(false,null,err)}
  const json=JSON.stringify(out);if(callback){if(!/^[a-zA-Z_$][\w$]{0,100}$/.test(callback))return ContentService.createTextOutput('Callback inválido');return ContentService.createTextOutput(callback+'('+json+');').setMimeType(ContentService.MimeType.JAVASCRIPT)}
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
function authorized(secret){let valid=props().getProperty('ADMIN_PASSWORD');if(!valid||String(secret||'')!==valid)throw Error('Senha administrativa incorreta')}
function doPost(e){let nonce=String(e.parameter.nonce||''),result;
  try{let action=String(e.parameter.action||''),payload=JSON.parse(e.parameter.payload||'{}'),secret=e.parameter.secret||'';
    if(!action||!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Requisição inválida');
    let lock=LockService.getScriptLock();if(!lock.tryLock(LOCK_SECONDS*1000))throw Error('Servidor ocupado, tente novamente');
    try{result=response(true,dispatch(action,payload,secret))}finally{lock.releaseLock()}
  }catch(err){result=response(false,null,err)}
  // HtmlService roda em iframe sandbox: envia confirmação para a página GitHub Pages.
  let msg=JSON.stringify({channel:'menuflow-response',nonce:nonce,ok:result.ok,data:result.data,error:result.error}).replace(/</g,'\\u003c');
  return HtmlService.createHtmlOutput('<!doctype html><html><body><script>window.parent.postMessage('+msg+',"*");<\/script></body></html>');
}
function dispatch(action,p,secret){if(action==='checkout')return checkout(p);
  authorized(secret);
  if(action==='admin_data')return {...publicData(),categories:rows('categories'),products:rows('products'),orders:rows('orders').reverse()};
  if(action==='save_settings'){
    let allowed=['store_name','open','whatsapp','delivery_fee','pix_key'];Object.entries(p).forEach(([key,value])=>{if(!allowed.includes(key))return;let old=rows('settings').find(r=>r.key===key);old?editSetting(key,String(value).slice(0,250)):append('settings',{key,value:String(value).slice(0,250)})});return settings();
  }
  if(action==='save_category'||action==='save_product'){
    const table=action==='save_category'?'categories':'products';let name=String(p.name||'').trim().slice(0,140);if(!name)throw Error('Informe o nome');
    let item={...p,name,active:p.active===false?'false':'true',position:Number(p.position)||0};
    if(table==='products'){item.price=Number(p.price);if(!Number.isFinite(item.price)||item.price<0)throw Error('Preço inválido');item.stock=Math.max(-1,Math.trunc(Number(p.stock??-1)));item.description=String(p.description||'').slice(0,700);item.image=String(p.image||'').slice(0,500);if(!rows('categories').some(c=>String(c.id)===String(p.category_id)))throw Error('Categoria inexistente')}
    return p.id?edit(table,p.id,item):append(table,{...item,id:Utilities.getUuid()});
  }
  if(action==='delete_category'||action==='delete_product'){
    let table=action==='delete_category'?'categories':'products';if(table==='categories'&&rows('products').some(r=>String(r.category_id)===String(p.id)))throw Error('Remova primeiro os produtos da categoria');return remove(table,p.id)
  }
  if(action==='update_order'){if(!['recebido','preparando','pronto','entrega','concluido','cancelado'].includes(p.status))throw Error('Status inválido');return edit('orders',p.id,{status:p.status})}
  if(action==='upload_image')return upload(p);
  throw Error('Operação desconhecida');
}
function editSetting(key,value){let sh=sheet('settings'),v=sh.getDataRange().getValues();for(let i=1;i<v.length;i++)if(String(v[i][0])===key){sh.getRange(i+1,2).setValue(value);return}throw Error('Configuração inexistente')}
function checkout(p){let cfg=settings();if(cfg.open!=='true')throw Error('Loja fechada temporariamente');let customer=String(p.customer||'').trim().slice(0,100),phone=String(p.phone||'').replace(/\D/g,'').slice(0,15);if(customer.length<2||phone.length<10)throw Error('Informe nome e telefone válido');
  let delivery=['entrega','retirada'].includes(p.delivery)?p.delivery:'retirada';let address=String(p.address||'').trim().slice(0,300);if(delivery==='entrega'&&address.length<8)throw Error('Informe o endereço');
  if(!Array.isArray(p.items)||p.items.length<1||p.items.length>40)throw Error('Carrinho inválido');let available=rows('products').filter(x=>String(x.active)!=='false');let lines=[],subtotal=0,requested={};
  for(let entry of p.items){let product=available.find(x=>String(x.id)===String(entry.id)),qty=Number(entry.qty);if(!product||!Number.isInteger(qty)||qty<1||qty>50)throw Error('Produto ou quantidade inválida');let stock=Number(product.stock);requested[product.id]=(requested[product.id]||0)+qty;if(stock>=0&&requested[product.id]>stock)throw Error('Estoque insuficiente: '+product.name);let price=Number(product.price);if(!Number.isFinite(price)||price<0)throw Error('Preço inválido');subtotal+=price*qty;lines.push({id:product.id,name:product.name,qty,price})}
  let fee=delivery==='entrega'?Math.max(0,Number(cfg.delivery_fee)||0):0,total=Math.round((subtotal+fee)*100)/100;if(total>100000)throw Error('Valor fora do limite');
  let order={id:String(Date.now())+'-'+Utilities.getUuid().slice(0,6).toUpperCase(),created_at:new Date().toISOString(),customer,phone,delivery,address:delivery==='entrega'?address:'Retirada',payment:String(p.payment||'a combinar').slice(0,60),notes:String(p.notes||'').slice(0,500),items:JSON.stringify(lines),total,status:'recebido'};
  append('orders',order);
  for(let id in requested){let product=available.find(x=>String(x.id)===id);if(Number(product.stock)>=0)edit('products',id,{stock:Number(product.stock)-requested[id]})}
  return {id:order.id,total:order.total,status:order.status,items:lines,pix_key:cfg.pix_key||''};
}
function upload(p){let mime=String(p.mime||'');if(!/^image\/(jpeg|png|webp|gif)$/.test(mime))throw Error('Formato de imagem não aceito');let data=String(p.base64||'');if(data.length>6500000)throw Error('Imagem grande demais (máx. 4MB)');let bytes=Utilities.base64Decode(data);if(bytes.length>4500000)throw Error('Imagem grande demais');let folder=DriveApp.getFolderById(props().getProperty('DRIVE_FOLDER_ID'));let ext=mime.split('/')[1].replace('jpeg','jpg');let file=folder.createFile(Utilities.newBlob(bytes,mime,Utilities.getUuid()+'.'+ext));file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);return {url:'https://drive.google.com/thumbnail?id='+file.getId()+'&sz=w1200',id:file.getId()}}
