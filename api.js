const URL_API = window.MENUFLOW_CONFIG?.apiUrl || '';
export const formatBRL = n => Number(n || 0).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
export const safe = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const photo = x => {let s=String(x||'');return /^https:\/\//.test(s)||/^\.\/imagens\//.test(s)?s:''};
export function configured(){return /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec/.test(URL_API)}
function apiURL(){if(!configured())throw Error('Configure a URL do Apps Script no arquivo config.js.');return URL_API}
// Leitura JSONP: apenas dados públicos (não enviar segredo em URLs).
export function read(action='catalog') { return new Promise((resolve,reject)=>{
  let name='mf_'+Math.random().toString(36).slice(2), el=document.createElement('script'), done=false;
  let timeout=setTimeout(()=>end(Error('Tempo esgotado ao consultar o Google Sheets.')),20000);
  function end(err,value){if(done)return;done=true;clearTimeout(timeout);el.remove();delete window[name];err?reject(err):resolve(value)}
  window[name]=r=>r?.ok?end(null,r.data):end(Error(r?.error||'Falha na consulta'));
  el.onerror=()=>end(Error('Não foi possível acessar o Apps Script. Confira a implantação.'));
  try{let u=new URL(apiURL());u.searchParams.set('action',action);u.searchParams.set('callback',name);u.searchParams.set('_',Date.now());el.src=u;document.head.append(el)}catch(e){end(e)}
}) }
// Escrita via formulário em iframe: contorna CORS em GitHub Pages sem expor tokens em URL.
// Resposta pelo postMessage com identificador aleatório, validada pelo protocolo e pelo iframe.
export function write(action,data={},secret=''){return new Promise((resolve,reject)=>{
  let frame=document.createElement('iframe');frame.name='mf_post_'+crypto.randomUUID();frame.hidden=true;frame.setAttribute('aria-hidden','true');
  let form=document.createElement('form');form.method='POST';form.action=apiURL();form.target=frame.name;form.hidden=true;
  let nonce=crypto.randomUUID(),done=false;
  for(const [name,value] of Object.entries({action,payload:JSON.stringify(data),secret,nonce})){
    let input=document.createElement('input');input.name=name;input.value=value;form.append(input);
  }
  function finish(err,result){if(done)return;done=true;clearTimeout(timer);window.removeEventListener('message',receive);form.remove();setTimeout(()=>frame.remove(),1000);err?reject(err):resolve(result)}
  function receive(event){let msg=event.data;if(!msg||msg.channel!=='menuflow-response'||msg.nonce!==nonce)return;
    // Apps Script HTML Service pode responder de domínios *.googleusercontent.com.
    if(!/^https:\/\/([a-z0-9.-]+\.)?googleusercontent\.com$/.test(event.origin)&&event.origin!=='https://script.google.com')return;
    msg.ok?finish(null,msg.data):finish(Error(msg.error||'Operação recusada'));
  }
  let timer=setTimeout(()=>finish(Error('Sem resposta do Apps Script. Confira permissões e implantação.')),45000);
  window.addEventListener('message',receive);document.body.append(frame,form);form.submit();
})}
export function alertMsg(message){let e=document.createElement('div');e.className='toast';e.textContent=message;document.body.append(e);setTimeout(()=>e.remove(),4000)}
export function getSecret(){return sessionStorage.getItem('mf_admin_secret')||''}
export function auth(secret){sessionStorage.setItem('mf_admin_secret',secret)}
export function signout(){sessionStorage.removeItem('mf_admin_secret')}
