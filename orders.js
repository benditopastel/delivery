import {api,money,esc,notify,hasSession} from './common.js';
import {login} from './transport.js';
const $=id=>document.getElementById(id);
const store={get:k=>{try{return localStorage.getItem(k)}catch{return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch{}}};
let orders=[],known=null,activated=false,actx=null,ringTimer=null,pollTimer=null,flashTimer=null,polling=false,wake=null,lastOk=0,failures=0;
let interval=Number(store.get('mf_orders_interval'))||30;

/* ---------- login ---------- */
function stopAll(){clearInterval(pollTimer);clearInterval(ringTimer);clearInterval(flashTimer);ringTimer=flashTimer=null}
function showLogin(msg=''){
 stopAll();
 document.body.innerHTML=`<main class="login"><h1>Acesso administrativo</h1><form id="order-login"><input name="email" type="email" autocomplete="username" placeholder="E-mail" required><input name="password" type="password" autocomplete="current-password" placeholder="Senha" required><button>Entrar</button><p id="order-error" role="alert">${esc(msg)}</p></form></main>`;
 $('order-login').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{await login(e.target.elements.email.value,e.target.elements.password.value);location.reload()}catch(err){$('order-error').textContent=err.message;b.disabled=false}};
}
window.addEventListener('mf-auth-lost',()=>showLogin('Sua sessão expirou. Entre novamente.'));

/* ---------- som: repete até todos os pedidos novos serem aceitos ---------- */
function beep(){
 if(!actx)return;actx.resume?.();const t=actx.currentTime;
 [[880,0],[660,.24],[880,.48],[660,.72]].forEach(([f,d])=>{const o=actx.createOscillator(),g=actx.createGain();o.type='square';o.frequency.value=f;g.gain.setValueAtTime(.0001,t+d);g.gain.exponentialRampToValueAtTime(.3,t+d+.02);g.gain.exponentialRampToValueAtTime(.0001,t+d+.2);o.connect(g).connect(actx.destination);o.start(t+d);o.stop(t+d+.22)});
 navigator.vibrate?.([250,120,250]);
}
function updateAlarm(pending){
 const ring=pending>0&&activated&&$('sound').checked;
 if(ring&&!ringTimer){beep();ringTimer=setInterval(beep,3000)}
 if(!ring&&ringTimer){clearInterval(ringTimer);ringTimer=null}
 if(pending>0&&!flashTimer){let on=false;flashTimer=setInterval(()=>{on=!on;document.title=on?`🔔 (${pending}) NOVO PEDIDO!`:'Central de pedidos'},900)}
 if(!pending&&flashTimer){clearInterval(flashTimer);flashTimer=null;document.title='Central de pedidos'}
 $('mutewarn').classList.toggle('on',pending>0&&!$('sound').checked);
}
function arrivalNotice(n){
 if('Notification' in window&&Notification.permission==='granted'){try{new Notification('🔔 Novo pedido!',{body:`${n} pedido(s) aguardando aceite`,tag:'mf-new',requireInteraction:true})}catch{}}
}
async function keepAwake(){try{if('wakeLock' in navigator&&!document.hidden)wake=await navigator.wakeLock.request('screen')}catch{}}

/* ---------- dados ---------- */
const pendingIds=()=>new Set(orders.filter(o=>o.status==='recebido').map(o=>o.id));
function detect(){
 const now=pendingIds();
 if(known){const fresh=[...now].filter(id=>!known.has(id));if(fresh.length)arrivalNotice(fresh.length)}
 known=now;updateAlarm(now.size);
}
async function poll(){
 if(polling)return;polling=true;
 try{orders=await api('/orders/live');lastOk=Date.now();failures=0;detect();draw()}
 catch(e){failures++;if(failures===1)notify(e.message)}
 finally{polling=false;chip()}
}
function schedule(){clearInterval(pollTimer);pollTimer=setInterval(poll,interval*1000)}
function chip(){
 if(!$('chip'))return;
 const t=lastOk?new Date(lastOk).toLocaleTimeString('pt-BR'):'--';
 $('chip').classList.toggle('err',failures>0);
 $('chiptext').textContent=failures>0?`sem conexão — última atualização ${t} (tentando de novo)`:`ao vivo · atualizado ${t} · a cada ${interval}s`;
}

/* ---------- apresentação ---------- */
const ago=iso=>{const m=Math.max(0,Math.floor((Date.now()-new Date(iso).getTime())/60000));return m<1?'agora':m<60?`há ${m} min`:`há ${Math.floor(m/60)} h ${m%60} min`};
const minutes=iso=>Math.floor((Date.now()-new Date(iso).getTime())/60000);
const phoneLinks=ph=>{const d=String(ph||'').replace(/\D/g,'');return `<a href="tel:+55${d}">${esc(ph)}</a> · <a target="_blank" rel="noopener" href="https://wa.me/55${d}">WhatsApp</a>`};
function payBlock(o){
 if(o.payment==='pix')return `<span class="pay pix">◆ PIX</span>cliente paga pelo app do banco — confira o recebimento`;
 if(o.payment==='dinheiro')return `<span class="pay cash">💵 DINHEIRO</span>${Number(o.change_for)>0?`Troco para <b>${money(o.change_for)}</b> → devolver <b>${money(o.change_amount)}</b>`:'<b>sem troco</b>'}`;
 return `<span class="pay card">💳 CARTÃO</span>levar a maquininha`;
}
function itemsHtml(o){
 let lines=[];try{lines=JSON.parse(o.items||'[]')}catch{}
 return `<ul class="items">${lines.map(x=>`<li><b>${x.qty}×</b> ${esc(x.name)}${(x.addons||[]).length?`<ul class="opts">${x.addons.map(a=>`<li>${a.group?`<span class="g">${esc(a.group)}:</span> `:'+ '}${(a.qty||1)>1?a.qty+'× ':''}${esc(a.name)}</li>`).join('')}</ul>`:''}${x.obs?`<div class="obs">📝 ${esc(x.obs)}</div>`:''}</li>`).join('')}</ul>`;
}
function actions(o){
 const A=(label,status,cls)=>`<button class="${cls}" data-id="${esc(o.id)}" data-status="${status}">${label}</button>`;
 let b='';
 if(o.status==='recebido')b=A('✔ Aceitar pedido','preparando','go')+A('Recusar','cancelado','no');
 else if(o.status==='preparando')b=A('✔ Pedido pronto','pronto','go');
 else if(o.status==='pronto')b=o.delivery==='retirada'?A('✔ Entregue ao cliente','concluido','go'):A('🛵 Saiu para entrega','em entrega','go2');
 else if(o.status==='em entrega')b=A('✔ Concluir entrega','concluido','go');
 return `<div class="acts">${b}<button class="print" data-print="${esc(o.id)}" title="Imprimir comanda">🖨</button></div>`;
}
function ticket(o){
 const isDel=o.delivery==='entrega',late=o.status==='recebido'&&minutes(o.created_at)>=5;
 const closed=['concluido','cancelado'].includes(o.status);
 return `<article class="ticket st-${esc(String(o.status).replace(/\s+/g,'-'))}"><div class="th"><span class="id">#${esc(String(o.id).slice(0,6).toUpperCase())}</span><span class="ago ${late?'late':''}">${esc(ago(o.created_at))}</span></div>
 <div class="tags"><span class="tag ${isDel?'del':'pick'}">${isDel?'🛵 ENTREGA':'🏪 RETIRADA'}</span>${o.status==='cancelado'?'<span class="tag">CANCELADO</span>':''}${o.coupon?`<span class="tag">🏷 ${esc(o.coupon)}</span>`:''}</div>
 <p class="who"><b>${esc(o.customer)}</b><br>${phoneLinks(o.phone)}</p>
 ${itemsHtml(o)}
 ${o.notes?`<div class="obs">📝 ${esc(o.notes)}</div>`:''}
 ${isDel?`<p class="addr">📍 ${esc(o.address||'')} — <a target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address||'')}">abrir no mapa ↗</a></p>`:''}
 <p class="payline">${payBlock(o)}</p>
 <div class="money"><small>${Number(o.discount)>0?`desconto ${money(o.discount)} · `:''}${isDel&&Number(o.fee)>0?`entrega ${money(o.fee)}`:''}</small><strong>${money(o.total)}</strong></div>
 ${closed?'':actions(o)}</article>`;
}
function draw(){
 if(!$('new'))return;
 const by={new:[],prep:[],out:[],done:[]};
 for(const o of orders){
  if(o.status==='recebido')by.new.push(o);else if(o.status==='preparando')by.prep.push(o);
  else if(o.status==='pronto'||o.status==='em entrega')by.out.push(o);else by.done.push(o);
 }
 const asc=(a,b)=>new Date(a.created_at)-new Date(b.created_at);
 by.new.sort(asc);by.prep.sort(asc);by.out.sort(asc);by.done.sort((a,b)=>asc(b,a));
 const msg={new:'Nenhum pedido novo. Este painel atualiza sozinho.',prep:'Nada em preparo.',out:'Nada aguardando entrega/retirada.',done:'Sem pedidos finalizados recentes.'};
 for(const k of Object.keys(by)){
  $(k).innerHTML=by[k].map(ticket).join('')||`<div class="empty">${msg[k]}</div>`;
  $('c-'+k).textContent=by[k].length;$('n-'+k).textContent=by[k].length;
 }
}

/* ---------- ações ---------- */
function printTicket(o){
 const w=window.open('','_blank','width=400,height=680');if(!w)return notify('Permita pop-ups para imprimir');
 let lines=[];try{lines=JSON.parse(o.items||'[]')}catch{}
 w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Pedido ${esc(o.id)}</title><style>body{font:13px monospace;width:72mm;margin:0 auto;padding:6px}h1{font-size:17px;margin:0}hr{border:0;border-top:1px dashed #000}ul{list-style:none;padding-left:14px;margin:2px 0}li{margin:3px 0}</style></head><body><h1>PEDIDO #${esc(String(o.id).slice(0,6).toUpperCase())}</h1><div>${esc(new Date(o.created_at).toLocaleString('pt-BR'))}</div><hr><b>${esc(o.customer)}</b><br>${esc(o.phone)}<br>${o.delivery==='entrega'?'ENTREGA: '+esc(o.address||''):'RETIRADA NA LOJA'}<hr><ul>${lines.map(x=>`<li><b>${x.qty}x ${esc(x.name)}</b>${(x.addons||[]).map(a=>`<ul><li>${a.group?esc(a.group)+': ':'+ '}${(a.qty||1)>1?a.qty+'x ':''}${esc(a.name)}</li></ul>`).join('')}${x.obs?`<ul><li>OBS: ${esc(x.obs)}</li></ul>`:''}</li>`).join('')}</ul>${o.notes?`<div>OBS: ${esc(o.notes)}</div>`:''}<hr>Pagamento: ${esc(o.payment)}${o.payment==='dinheiro'&&Number(o.change_for)>0?` (troco p/ ${money(o.change_for)} - devolver ${money(o.change_amount)})`:''}<br><b>TOTAL: ${money(o.total)}</b><script>onload=()=>{print()}<\/script></body></html>`);
 w.document.close();
}
async function onBoardClick(e){
 const pr=e.target.closest('[data-print]');
 if(pr){const o=orders.find(x=>String(x.id)===pr.dataset.print);if(o)printTicket(o);return}
 const b=e.target.closest('[data-status]');if(!b)return;
 if(b.dataset.status==='cancelado'&&!confirm('Recusar este pedido?'))return;
 b.disabled=true;
 try{
  await api('/orders/'+b.dataset.id,{method:'PATCH',body:JSON.stringify({status:b.dataset.status})});
  const o=orders.find(x=>String(x.id)===b.dataset.id);if(o)o.status=b.dataset.status;
  detect();draw();
 }catch(err){notify(err.message);b.disabled=false}
}

/* ---------- início ---------- */
function start(){
 $('sound').checked=store.get('mf_orders_sound')!=='0';
 $('interval').value=String(interval);
 $('sound').onchange=()=>{store.set('mf_orders_sound',$('sound').checked?'1':'0');updateAlarm(pendingIds().size)};
 $('interval').onchange=()=>{interval=Number($('interval').value);store.set('mf_orders_interval',interval);schedule();chip()};
 $('refresh').onclick=poll;
 $('board').addEventListener('click',onBoardClick);
 $('start').onclick=async()=>{
  try{actx||=new (window.AudioContext||window.webkitAudioContext)();await actx.resume()}catch{notify('Seu navegador bloqueou o áudio')}
  activated=true;$('gate').remove();
  if('Notification' in window&&Notification.permission==='default')Notification.requestPermission().catch(()=>{});
  keepAwake();updateAlarm(pendingIds().size);
 };
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){poll();keepAwake()}});
 window.addEventListener('online',poll);
 setInterval(()=>{draw();chip()},20000); // atualiza "há X min" e destaca pedidos parados
 poll();schedule();
}
if(!hasSession())showLogin();else start();
