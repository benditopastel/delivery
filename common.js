import {read,write,getSecret,auth,signout} from './transport.js';
let loggedIn=false;
export {auth,signout};
export const api = async (path, options={}) => {
 const method=(options.method||'GET').toUpperCase();
 if (method==='GET' && (path==='/bootstrap'||path==='/loyalty/catalog') && !getSecret()) {
  const d=await read('catalog');
  return path==='/loyalty/catalog'?d.rewards.filter(x=>x.active):d;
 }
 const body=options.body?JSON.parse(options.body):{};
 if(path==='/bootstrap')return write('bootstrap',{},getSecret());
 if(path==='/orders/live')return write('orders_live',{},getSecret());
 if(path==='/loyalty/catalog')return read('catalog').then(d=>d.rewards.filter(x=>x.active));
 if(path==='/loyalty/redeem')throw Error('Resgate indisponível até implementar verificação do cliente.');
 if(path==='/checkout')return write('checkout',body);
 if(path==='/settings')return write('settings',body,getSecret());
 if(path==='/reorder')return write('reorder',body,getSecret());
 let match=path.match(/^\/manage\/([a-z_]+)(?:\/([^/]+))?$/);
 if(match)return write('manage',{table:match[1],id:match[2]||'',method,data:body},getSecret());
 match=path.match(/^\/orders\/([^/]+)$/);
 if(match)return write('order_status',{id:match[1],...body},getSecret());
 throw Error('Endpoint inválido: '+path);
};
export const money = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const photo = (item, css = '') => { let url = (item.images || item.image || '').split(',')[0]; if(url.startsWith('/uploads/'))url='./imagens/'+url.split('/').pop(); const t = (item.name || '').toLowerCase(); const emoji = t.includes('batata') ? '🍟' : t.includes('refrigerante') || t.includes('bebida') ? '🥤' : t.includes('chicken') ? '🍗' : t.includes('combo') ? '🍔' : t.includes('molho') ? '🥫' : '🍔'; return `<div class="photo ${css}">${url ? `<img src="${esc(url)}" loading="lazy" alt="${esc(item.name)}">` : `<span class="placeholder">${emoji}</span>`}</div>`; };
export function notify(message) { document.querySelector('.toast')?.remove(); const d = document.createElement('div'); d.className = 'toast'; d.textContent = message; document.body.append(d); setTimeout(() => d.remove(), 3200); }
export const parseAddons = s => String(s || '').split(',').filter(Boolean);
export const toggleModal = (html) => { document.querySelector('.modalshade')?.remove(); let node = document.createElement('div'); node.className = 'modalshade'; node.innerHTML = `<div class="modal">${html}</div>`; node.addEventListener('click', e => { if (e.target === node || e.target.closest('[data-close]'))
    node.remove(); }); document.body.append(node); return node; };

