import { api, money, esc, notify } from './common.js';
let known = null, activated = false, audioContext = null, busy = false;
const byId = id => document.getElementById(id);
async function beep() { if (!activated || !byId('sound').checked)
    return; try {
    const audio = byId('alert');
    await audio.play();
    return;
}
catch { } try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();
    const osc = audioContext.createOscillator(), gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.value = 780;
    gain.gain.setValueAtTime(.13, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .45);
    osc.connect(gain).connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + .45);
}
catch { } }
function ticket(o) { let lines = []; try {
    lines = JSON.parse(o.items || '[]');
}
catch { } const next = { recebido: [['Aceitar', 'preparando'], ['Cancelar', 'cancelado']], preparando: [['Pronto', 'pronto']], pronto: o.delivery === 'retirada' ? [['Entregue', 'concluido']] : [['Saiu para entrega', 'em entrega']], 'em entrega': [['Concluir', 'concluido']] }; const address = o.delivery === 'entrega' ? `<p><b>Endereço:</b> ${esc(o.address || '')}</p><a target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address || '')}">Abrir endereço no mapa ↗</a>` : '<p>Retirada na loja</p>'; return `<article class="order-ticket"><b>#${esc(o.id)}</b> <span class="order-muted">${esc(o.created_at || '')}</span><p><b>${esc(o.customer)}</b> · ${esc(o.phone)}</p><p>${lines.map(x => `${x.qty}× ${esc(x.name)}`).join('<br>')}</p>${address}<p>Pagamento: ${esc(o.payment)} ${o.payment === 'dinheiro' && Number(o.change_for) > 0 ? `· Troco para ${money(o.change_for)} (devolver ${money(o.change_amount)})` : ''}</p><b>${money(o.total)}</b><div>${(next[o.status] || []).map(([label, status]) => `<button class="${status === 'cancelado' ? 'outline' : 'primary'}" data-id="${esc(o.id)}" data-status="${status}">${label}</button>`).join('')}</div></article>`; }
async function refresh() { if (busy)
    return; busy = true; try {
    const orders = await api('/orders/live');
    const fresh = new Set(orders.filter(o => o.status === 'recebido').map(o => o.id));
    if (known !== null && [...fresh].some(id => !known.has(id)))
        beep();
    known = fresh;
    const sections = { new: orders.filter(o => o.status === 'recebido'), preparing: orders.filter(o => o.status === 'preparando'), delivery: orders.filter(o => ['pronto', 'em entrega'].includes(o.status)) };
    for (const [id, items] of Object.entries(sections))
        byId(id).innerHTML = items.slice().reverse().map(ticket).join('') || '<p class="order-muted">Nenhum pedido nesta etapa.</p>';
    byId('count-new').textContent = `(${fresh.size})`;
    document.querySelectorAll('[data-status]').forEach(b => b.onclick = async () => { try {
        await api('/orders/' + b.dataset.id, { method: 'PATCH', body: JSON.stringify({ status: b.dataset.status }) });
        await refresh();
    }
    catch (e) {
        notify(e.message);
    } });
}
catch (e) {
    notify(e.message);
}
finally {
    busy = false;
} }
byId('enable-sound').onclick = async () => { activated = true; try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();
    notify('Alerta ativado');
}
catch {
    notify('Seu navegador bloqueou o áudio');
} };
byId('refresh').onclick = refresh;
refresh();
setInterval(() => { if (!document.hidden)
    refresh(); }, 30000);

