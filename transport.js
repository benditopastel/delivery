// Supabase Edge Function: somente chave publishable/anon no navegador.
export const formatBRL=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function getConfig(){const c=window.MENUFLOW_CONFIG||{};return {url:String(c.supabaseUrl||'').replace(/\/$/,''),key:String(c.supabaseKey||''),region:String(c.region||''),functionName:'menuflow'}}
export function configured(){const c=getConfig();return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(c.url)&&!!c.key}

// ---- sessão do administrador (localStorage: sobrevive a fechar a aba; renova sozinha) ----
const SESSION='mf_auth_session';
export const AUTH='__mf_auth__'; // sentinela: "use a sessão do admin, renovando se preciso"
const load=()=>{try{return JSON.parse(localStorage.getItem(SESSION)||'null')}catch{return null}};
function store(d){const s={access_token:d.access_token,refresh_token:d.refresh_token,expires_at:Math.floor(Date.now()/1000)+Number(d.expires_in||3600)};localStorage.setItem(SESSION,JSON.stringify(s));return s}
export const hasSession=()=>{const s=load();return !!(s&&(s.refresh_token||s.expires_at>Date.now()/1000+30))};
export const getSecret=()=>{const s=load();return s?.access_token&&s.expires_at>Date.now()/1000+30?s.access_token:''};
export function auth(){throw Error('Utilize login(email, senha) para acessar o painel')}
export function signout(){localStorage.removeItem(SESSION);sessionStorage.removeItem(SESSION)}
let refreshing=null;
export async function getToken(){
 const s=load();if(!s)return '';
 if(s.access_token&&s.expires_at>Date.now()/1000+60)return s.access_token;
 if(!s.refresh_token){signout();return ''}
 refreshing??=(async()=>{
  try{const c=getConfig();
   const r=await fetch(c.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{'content-type':'application/json',apikey:c.key},body:JSON.stringify({refresh_token:s.refresh_token})});
   const d=await r.json();if(!r.ok||!d.access_token){signout();return ''}
   return store(d).access_token;
  }catch{return s.access_token||''}finally{refreshing=null}
 })();
 return refreshing;
}
export async function login(email,password){
 const c=getConfig();if(!configured())throw Error('Configure config.js com a URL e chave pública do Supabase.');
 const r=await fetch(c.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{'content-type':'application/json',apikey:c.key},body:JSON.stringify({email,password})});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.access_token)throw Error('Login inválido ou usuário não autorizado.');
 store(d);
 try{await request('whoami',{},AUTH)}catch(e){signout();throw e}
 return true;
}

// ---- indicador global de carregamento (barra no topo) ----
let pending=0;
const busy=n=>{pending=Math.max(0,pending+n);document.documentElement.classList.toggle('mf-loading',pending>0)};

export async function request(action,data={},token=''){
 const c=getConfig();if(!configured())throw Error('Configure a URL e chave publicável em config.js.');
 let bearer=token;
 if(token===AUTH){bearer=await getToken();if(!bearer){window.dispatchEvent(new Event('mf-auth-lost'));throw Error('Faça login para acessar o painel')}}
 const headers={'content-type':'application/json',apikey:c.key,authorization:'Bearer '+(bearer||c.key)};
 if(c.region)headers['x-region']=c.region;
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),action==='upload'?60000:25000);
 let r;busy(1);
 try{r=await fetch(c.url+'/functions/v1/'+c.functionName,{method:'POST',headers,body:JSON.stringify({action,data}),signal:ctl.signal})}
 catch(e){throw Error(e.name==='AbortError'?'A conexão demorou demais. Tente novamente.':'Não foi possível conectar ao Supabase: '+e.message)}
 finally{clearTimeout(timer);busy(-1)}
 const body=await r.json().catch(()=>({error:'Resposta inesperada da API'}));
 if(r.status===401&&token===AUTH){signout();window.dispatchEvent(new Event('mf-auth-lost'))}
 if(!r.ok||body.ok===false)throw Error(body.error||('HTTP '+r.status));
 return body.data;
}
export const read=(action='catalog',params={})=>request(action,params);
export const write=(action,data={},token='')=>request(action,data,token);
export function alertMsg(message){const e=document.createElement('div');e.className='toast';e.textContent=message;document.body.append(e);setTimeout(()=>e.remove(),4000)}
