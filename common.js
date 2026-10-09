/**
 * Adaptador público do MenuFlow Lite.
 * Nesta etapa somente a leitura do cardápio está disponível.
 * Operações de pedidos e administração aguardam API autenticada.
 */
const API_URL = 'https://script.google.com/macros/s/AKfycbzTbSY3jkeBrmyOQGeSiHSn2l0XSY7pXg68ILHaDkqAqcaV8baVi4Ec6Btbr1j8lQPc/exec';

function asBoolean(value) {
  if (typeof value === 'boolean') return value;
  return !['false', '0', 'não', 'nao', ''].includes(String(value ?? '').toLowerCase());
}

function normalizeItem(item) {
  return {
    ...item,
    name: item.nome ?? item.name ?? '',
    description: item.descricao ?? item.description ?? '',
    price: Number(item.preco ?? item.price ?? 0),
    sale_price: Number(item.preco_promocional ?? item.sale_price ?? 0),
    image: item.imagem ?? item.image ?? '',
    images: item.imagens ?? item.images ?? item.imagem ?? '',
    position: Number(item.posicao ?? item.position ?? 0),
    active: asBoolean(item.ativo ?? item.active ?? true),
    stock: Number(item.estoque ?? item.stock ?? 0),
    category_id: item.categoria_id ?? item.category_id ?? '',
    min_select: Number(item.minimo ?? item.min_select ?? 0),
    max_select: Number(item.maximo ?? item.max_select ?? 1),
    required: asBoolean(item.obrigatorio ?? item.required ?? false),
    options: item.opcoes_json ?? item.options ?? '[]'
  };
}

function normalizePublicData(data) {
  const settings = Object.fromEntries(
    (data.configuracoes || []).map(row => [row.chave, row.valor])
  );

  return {
    categories: (data.categorias || []).map(normalizeItem),
    products: (data.produtos || []).map(normalizeItem),
    addons: (data.complementos || []).map(normalizeItem),
    addon_groups: (data.grupos_complementos || []).map(normalizeItem),
    banners: (data.banners || []).map(normalizeItem),
    rewards: (data.recompensas || []).map(normalizeItem),
    settings
  };
}

export async function api(path, options = {}) {
  if (path !== '/bootstrap' || (options.method || 'GET') !== 'GET') {
    throw new Error(
      'Função temporariamente indisponível: integração segura em desenvolvimento.'
    );
  }

  const response = await fetch(`${API_URL}?action=cardapio`, {
    method: 'GET',
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error('Não foi possível carregar o cardápio.');
  }

  const result = await response.json();
  if (!result.sucesso) {
    throw new Error(result.erro || 'Erro ao consultar o cardápio.');
  }

  return normalizePublicData(result.dados || {});
}

export const money = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const photo = (item, css = '') => { const url = (item.images || item.image || '').split(',')[0]; const t = (item.name || '').toLowerCase(); const emoji = t.includes('batata') ? '🍟' : t.includes('refrigerante') || t.includes('bebida') ? '🥤' : t.includes('chicken') ? '🍗' : t.includes('combo') ? '🍔' : t.includes('molho') ? '🥫' : '🍔'; return `<div class="photo ${css}">${url ? `<img src="${esc(url)}" loading="lazy" alt="${esc(item.name)}">` : `<span class="placeholder">${emoji}</span>`}</div>`; };
export function notify(message) { document.querySelector('.toast')?.remove(); const d = document.createElement('div'); d.className = 'toast'; d.textContent = message; document.body.append(d); setTimeout(() => d.remove(), 3200); }
export const parseAddons = s => String(s || '').split(',').filter(Boolean);
export const toggleModal = (html) => { document.querySelector('.modalshade')?.remove(); let node = document.createElement('div'); node.className = 'modalshade'; node.innerHTML = `<div class="modal">${html}</div>`; node.addEventListener('click', e => { if (e.target === node || e.target.closest('[data-close]'))
    node.remove(); }); document.body.append(node); return node; };

