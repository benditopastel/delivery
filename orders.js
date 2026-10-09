import { api, money, esc, notify } from './common.js';

const byId = id => document.getElementById(id);
let busy = false;
let soundEnabled = false;
let audioContext = null;
let pendingCount = 0;
let lastError = '';
const POLL_MS = 5000;
const ALARM_MS = 1800;

async function soundOnce() {
  if (!soundEnabled || !byId('sound').checked || pendingCount === 0) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(740, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(920, audioContext.currentTime + 0.18);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.09, audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.46);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.47);
  } catch (e) {
    console.warn('Não foi possível tocar o alerta:', e);
  }
}

function ticket(o) {
  let lines = [];
  try { lines = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []); }
  catch { /* Pedido com itens inválidos não deve interromper o monitor. */ }
  const next = {
    recebido: [['Aceitar', 'preparando'], ['Cancelar', 'cancelado']],
    preparando: [['Pronto', 'pronto']],
    pronto: o.delivery === 'retirada' ? [['Entregue', 'concluido']] : [['Saiu para entrega', 'em entrega']],
    'em entrega': [['Concluir', 'concluido']]
  };
  const address = o.delivery === 'entrega'
    ? `<p><b>Endereço:</b> ${esc(o.address || '')}</p><a target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address || '')}">Abrir endereço no mapa ↗</a>`
    : '<p>Retirada na loja</p>';
  return `<article class="order-ticket"><b>#${esc(o.id)}</b> <span class="order-muted">${esc(o.created_at || '')}</span><p><b>${esc(o.customer)}</b> · ${esc(o.phone)}</p><p>${lines.map(x => `${Number(x.qty) || 1}× ${esc(x.name)}`).join('<br>')}</p>${address}<p>Pagamento: ${esc(o.payment)} ${o.payment === 'dinheiro' && Number(o.change_for) > 0 ? `· Troco para ${money(o.change_for)} (devolver ${money(o.change_amount)})` : ''}</p><b>${money(o.total)}</b><div>${(next[o.status] || []).map(([label, status]) => `<button class="${status === 'cancelado' ? 'outline' : 'primary'}" data-id="${esc(o.id)}" data-status="${status}">${label}</button>`).join('')}</div></article>`;
}

async function refresh() {
  if (busy) return;
  busy = true;
  try {
    const orders = await api('/orders/live');
    const received = orders.filter(o => o.status === 'recebido');
    const wasSilent = pendingCount === 0;
    pendingCount = received.length;
    const sections = {
      new: received,
      preparing: orders.filter(o => o.status === 'preparando'),
      delivery: orders.filter(o => ['pronto', 'em entrega'].includes(o.status))
    };
    for (const [id, items] of Object.entries(sections)) {
      byId(id).innerHTML = items.slice().reverse().map(ticket).join('') || '<p class="order-muted">Nenhum pedido nesta etapa.</p>';
    }
    byId('count-new').textContent = `(${pendingCount})`;
    byId('monitor-status').textContent = `Monitor ativo · última consulta ${new Date().toLocaleTimeString('pt-BR')}`;
    document.title = pendingCount ? `(${pendingCount}) Pedidos aguardando · MenuFlow` : 'Central de pedidos · MenuFlow';
    if (wasSilent && pendingCount) void soundOnce();
    lastError = '';
  } catch (e) {
    byId('monitor-status').textContent = 'Falha na consulta · tentando novamente automaticamente';
    if (lastError !== e.message) notify(e.message);
    lastError = e.message;
  } finally {
    busy = false;
  }
}

byId('enable-sound').onclick = async () => {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();
    soundEnabled = true;
    byId('sound').checked = true;
    byId('enable-sound').textContent = 'Som ativado';
    notify('Alerta sonoro ativado. Ele tocará até todos os novos pedidos serem aceitos ou cancelados.');
    void soundOnce();
  } catch {
    notify('O navegador bloqueou o áudio. Clique novamente em Ativar som.');
  }
};
byId('sound').onchange = () => { if (byId('sound').checked && !soundEnabled) byId('enable-sound').click(); };
byId('refresh').onclick = refresh;

// Delegação: os botões são recriados em cada atualização.
document.querySelector('.orders-columns').addEventListener('click', async event => {
  const button = event.target.closest('button[data-status]');
  if (!button || button.disabled) return;
  button.disabled = true;
  try {
    await api('/orders/' + encodeURIComponent(button.dataset.id), {
      method: 'PATCH', body: JSON.stringify({ status: button.dataset.status })
    });
    // Atualiza imediatamente após aceitar; o alarme cessa quando não restam pedidos recebidos.
    await refresh();
  } catch (e) {
    notify(e.message);
    button.disabled = false;
  }
});

void refresh();
setInterval(() => { void refresh(); }, POLL_MS);
setInterval(() => { void soundOnce(); }, ALARM_MS);
window.addEventListener('focus', () => { void refresh(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
