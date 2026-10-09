export const api = async (url, options = {}) => { const r = await fetch('/api' + url, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options }); const j = await r.json(); if (!r.ok)
    throw Error(j.detail || 'Erro na operação'); return j; };
export const money = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const photo = (item, css = '') => { const url = (item.images || item.image || '').split(',')[0]; const t = (item.name || '').toLowerCase(); const emoji = t.includes('batata') ? '🍟' : t.includes('refrigerante') || t.includes('bebida') ? '🥤' : t.includes('chicken') ? '🍗' : t.includes('combo') ? '🍔' : t.includes('molho') ? '🥫' : '🍔'; return `<div class="photo ${css}">${url ? `<img src="${esc(url)}" loading="lazy" alt="${esc(item.name)}">` : `<span class="placeholder">${emoji}</span>`}</div>`; };
export function notify(message) { document.querySelector('.toast')?.remove(); const d = document.createElement('div'); d.className = 'toast'; d.textContent = message; document.body.append(d); setTimeout(() => d.remove(), 3200); }
export const parseAddons = s => String(s || '').split(',').filter(Boolean);
export const toggleModal = (html) => { document.querySelector('.modalshade')?.remove(); let node = document.createElement('div'); node.className = 'modalshade'; node.innerHTML = `<div class="modal">${html}</div>`; node.addEventListener('click', e => { if (e.target === node || e.target.closest('[data-close]'))
    node.remove(); }); document.body.append(node); return node; };

