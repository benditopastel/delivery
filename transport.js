const URL_API = window.MENUFLOW_CONFIG?.apiUrl || '';
export const formatBRL = n => Number(n || 0).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
export const safe = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const photo = x => {let s=String(x||'');return /^https:\/\//.test(s)||/^\.\/imagens\//.test(s)?s:''};
export function configured(){return /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec/.test(URL_API)}
function apiURL(){if(!configured())throw Error('Configure a URL do Apps Script no arquivo config.js.');return URL_API}
// Leitura JSONP: apenas dados públicos (não enviar segredo em URLs).
export function read(action='catalog', params={}) { return new Promise((resolve,reject)=>{
  let name='mf_'+Math.random().toString(36).slice(2), el=document.createElement('script'), done=false;
  let timeout=setTimeout(()=>end(Error('Tempo esgotado ao consultar o Google Sheets.')),20000);
  function end(err,value){if(done)return;done=true;clearTimeout(timeout);el.remove();delete window[name];err?reject(err):resolve(value)}
  window[name]=r=>r?.ok?end(null,r.data):end(Error(r?.error||'Falha na consulta'));
  el.onerror=()=>end(Error('Não foi possível acessar o Apps Script. Confira a implantação.'));
  try{let u=new URL(apiURL());u.searchParams.set('action',action);for(const [key,value] of Object.entries(params))u.searchParams.set(key,value);u.searchParams.set('callback',name);u.searchParams.set('_',Date.now());el.src=u;document.head.append(el)}catch(e){end(e)}
}) }
// Escrita cross-origin sem iframe: POST opaco + consulta JSONP do resultado.
// A senha só é enviada no corpo da requisição POST, nunca na URL.
export async function write(action,data={},secret='') {
  const nonce=crypto.randomUUID();
  const body=new URLSearchParams({action,payload:JSON.stringify(data),secret,nonce});
  const url=apiURL();
  const deadline=Date.now()+60000;
  // Enviar como simple request; Apps Script não disponibiliza cabeçalhos CORS.
  // A resposta do POST é opaca, por isso a confirmação vem pelo polling abaixo.
  const sending=fetch(url,{method:'POST',mode:'no-cors',body,redirect:'follow',credentials:'omit'});
  let sendError=null;
  sending.catch(err=>{sendError=err});
  await new Promise(r=>setTimeout(r,650));
  while(Date.now()<deadline){
    if(sendError)throw Error('Não foi possível enviar ao Apps Script: '+sendError.message);
    try {
      const state=await read('result', {nonce});
      if(!state.pending){
        if(state.result?.ok)return state.result.data;
        throw Error(state.result?.error||'Operação recusada');
      }
    } catch(err){
      // Erros de resposta do servidor são definitivos; somente falhas transitórias
      // de rede/JSONP podem ser tentadas novamente.
      if(!/Tempo esgotado|Não foi possível acessar/.test(err.message))throw err;
    }
    await new Promise(r=>setTimeout(r,1150));
  }
  throw Error('Sem confirmação do Apps Script em 60 segundos. Verifique a implantação e tente consultar os pedidos antes de reenviar.');
}
export function alertMsg(message){let e=document.createElement('div');e.className='toast';e.textContent=message;document.body.append(e);setTimeout(()=>e.remove(),4000)}
export function getSecret(){return sessionStorage.getItem('mf_admin_secret')||''}
export function auth(secret){sessionStorage.setItem('mf_admin_secret',secret)}
export function signout(){sessionStorage.removeItem('mf_admin_secret')}
