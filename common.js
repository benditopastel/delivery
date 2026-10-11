import {read,write,AUTH,auth,signout,hasSession} from './transport.js';
export {auth,signout,hasSession};
export const api = async (path, options={}) => {
 const method=(options.method||'GET').toUpperCase();
 const body=options.body?JSON.parse(options.body):{};
 if(path==='/catalog')return read('catalog');
 if(path==='/loyalty/catalog')return read('catalog').then(d=>d.rewards.filter(x=>x.active));
 if(path==='/bootstrap')return write('bootstrap',{},AUTH);
 if(path==='/orders/live')return write('orders_live',{},AUTH);
 if(path==='/loyalty/redeem')throw Error('Resgate indisponível até implementar verificação do cliente.');
 if(path==='/checkout')return write('checkout',body);
 if(path==='/settings')return write('settings',body,AUTH);
 if(path==='/reorder')return write('reorder',body,AUTH);
 let match=path.match(/^\/manage\/([a-z_]+)(?:\/([^/]+))?$/);
 if(match)return write('manage',{table:match[1],id:match[2]||'',method,data:body},AUTH);
 match=path.match(/^\/orders\/([^/]+)$/);
 if(match)return write('order_status',{id:match[1],...body},AUTH);
 throw Error('Endpoint inválido: '+path);
};
export const money = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Convenção: toda imagem enviada gera "thumb_<arquivo>" na mesma pasta (~25 KB). Listas usam a miniatura.
export const thumbOf = u => { u = String(u || ''); const i = u.lastIndexOf('/'); return i < 0 || /\/thumb_[^/]*$/.test(u) ? u : u.slice(0, i + 1) + 'thumb_' + u.slice(i + 1); };
document.addEventListener('error', e => { const t = e.target; if (t && t.tagName === 'IMG' && t.dataset.full && t.src !== new URL(t.dataset.full, location.href).href) t.src = t.dataset.full; }, true);
export const photo = (item, css = '') => { let url = (item.images || item.image || '').split(',')[0].trim(); if(url.startsWith('/uploads/'))url='./imagens/'+url.split('/').pop(); const t = (item.name || '').toLowerCase(); const emoji = t.includes('batata') ? '🍟' : t.includes('refrigerante') || t.includes('bebida') ? '🥤' : t.includes('chicken') ? '🍗' : t.includes('combo') ? '🍔' : t.includes('molho') ? '🥫' : '🍔'; const thumb = url ? thumbOf(url) : ''; return `<div class="photo ${css}">${url ? `<img src="${esc(thumb)}" ${thumb !== url ? `data-full="${esc(url)}"` : ''} loading="lazy" decoding="async" alt="${esc(item.name)}">` : `<span class="placeholder">${emoji}</span>`}</div>`; };
export function notify(message) { document.querySelector('.toast')?.remove(); const d = document.createElement('div'); d.className = 'toast'; d.textContent = message; document.body.append(d); setTimeout(() => d.remove(), 3200); }
export const parseAddons = s => String(s || '').split(',').filter(Boolean);
export const toggleModal = (html) => { document.querySelector('.modalshade')?.remove(); let node = document.createElement('div'); node.className = 'modalshade'; node.innerHTML = `<div class="modal">${html}</div>`; node.addEventListener('click', e => { if (e.target === node || e.target.closest('[data-close]'))
    node.remove(); }); document.body.append(node); return node; };

