// Supabase Edge Function: somente chave publishable/anon no navegador.
const STORAGE='menuflow_supabase';
export const formatBRL=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const photo=x=>{const s=String(x||'');return /^https:\/\//.test(s)||/^\.\/imagens\//.test(s)?s:''};
export function getConfig(){let c=window.MENUFLOW_CONFIG||{};return {url:String(c.supabaseUrl||'').replace(/\/$/,''),key:String(c.supabaseKey||''),functionName:'menuflow'};}
export function configured(){const c=getConfig();return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(c.url)&&!!c.key;}
const SESSION='mf_auth_session';
export function getSecret(){try {const t=JSON.parse(sessionStorage.getItem(SESSION)||'null');return t?.access_token&&t.expires_at>Date.now()/1000+30?t.access_token:''}catch{return ''}}
export function auth(){throw Error('Utilize login(email, senha) para acessar o painel')}
export function signout(){sessionStorage.removeItem(SESSION)}
export async function login(email,password){const c=getConfig();if(!configured())throw Error('Configure config.js com a URL e chave pública do Supabase.');const r=await fetch(c.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{'content-type':'application/json','apikey':c.key},body:JSON.stringify({email,password})});const d=await r.json();if(!r.ok||!d.access_token)throw Error('Login inválido ou usuário não autorizado.');sessionStorage.setItem(SESSION,JSON.stringify({...d,expires_at:Math.floor(Date.now()/1000)+Number(d.expires_in||3600)}));try{await request('bootstrap',{},getSecret())}catch(e){signout();throw e}return true}
export async function request(action,data={},token=''){
 const c=getConfig();if(!configured())throw Error('Configure a URL e chave publicável em config.js.');
 let r;try{r=await fetch(c.url+'/functions/v1/'+c.functionName,{method:'POST',headers:{'content-type':'application/json','apikey':c.key,'authorization':'Bearer '+(token||c.key)},body:JSON.stringify({action,data})})}catch(e){throw Error('Não foi possível conectar ao Supabase: '+e.message)}
 const body=await r.json().catch(()=>({error:'Resposta inesperada da API'}));if(!r.ok||body.ok===false)throw Error(body.error||('HTTP '+r.status));return body.data;
}
export const read=(action='catalog',params={})=>request(action,params);
export const write=(action,data={},token='')=>request(action,data,token);
export function alertMsg(message){let e=document.createElement('div');e.className='toast';e.textContent=message;document.body.append(e);setTimeout(()=>e.remove(),4000)}
