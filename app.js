'use strict';
/* =====================================================================
   GraoSafe — app.js
   Simulação de silos + alertas + sensor (Wokwi) + relatório
   Navegação por telas usando #hash (funciona abrindo o arquivo direto).
   ===================================================================== */

// ---------------------------------------------------------------------
// CONFIGURAÇÃO (editável na tela Configurações; salva no navegador)
// ---------------------------------------------------------------------
const PADRAO = { tempAtencao: 28, tempPerigo: 32, umidAtencao: 65, umidPerigo: 75, intervalo: 5000, passo: 10, tema: null, avisos: true, sons: false };
const CFG = Object.assign({}, PADRAO);
try { Object.assign(CFG, JSON.parse(localStorage.getItem('graosafe_cfg') || '{}')); } catch (e) {}
function salvarCfg() { try { localStorage.setItem('graosafe_cfg', JSON.stringify(CFG)); } catch (e) {} }

// Modelo da simulação (mesma lógica de dados/gerar_csv.py)
const SIM = {
  tempMedia: 27, tempAmplitude: 4, horaPico: 15, umidBase: 55, umidPorGrau: 2,
  ruidoTemp: 0.4, ruidoUmid: 1.5, falhaTemp: 7, falhaUmid: 18, falhaDesce: 0.25,
  maxAlertas: 100, maxPontos: 288
};
const INTENSIDADE = { leve: 0.06, media: 0.12, forte: 0.25 };

const SILOS = [
  { id: 'A', nome: 'Silo A', cultura: 'Soja',  dTemp: 0.0,  dUmid: 0.0 },
  { id: 'B', nome: 'Silo B', cultura: 'Milho', dTemp: -0.5, dUmid: 2.0 },
  { id: 'C', nome: 'Silo C', cultura: 'Soja',  dTemp: 0.8,  dUmid: 3.0 }   // mais quente e úmido
];
const NOMES_RISCO = { verde: 'SEGURO', amarelo: 'ATENÇÃO', vermelho: 'PERIGO' };
const ROTULO = { verde: 'Seguro', amarelo: 'Atenção', vermelho: 'Perigo' };
const ORDEM = { verde: 0, amarelo: 1, vermelho: 2 };

// Regra de risco (igual à do ESP32 e à do script Python)
function calcularRisco(t, u) {
  if (t > CFG.tempPerigo || u > CFG.umidPerigo) return 'vermelho';
  if (t >= CFG.tempAtencao || u >= CFG.umidAtencao) return 'amarelo';
  return 'verde';
}

// ---------------------------------------------------------------------
// ESTADO GLOBAL (continua rodando ao trocar de tela)
// ---------------------------------------------------------------------
const estado = {
  minutoSim: 6 * 60, leituras: [], porSilo: {}, ultimoRisco: {}, desde: {}, falha: {},
  alertas: [], naoLidos: 0, alertaSeq: 0, pausado: false, timer: null, ultimoTick: new Date(),
  inicioSim: new Date(new Date().setHours(0, 0, 0, 0))
};
SILOS.forEach(s => { estado.porSilo[s.id] = []; estado.falha[s.id] = { ativa: false, nivel: 0, sobe: INTENSIDADE.media }; });
const live = { ativo: {}, total: 0 };      // silos usando dados do sensor real
const ui = { serialTexto: '', siloSensor: 'A' };            // pequenos estados de interface

// ---------------------------------------------------------------------
// UTILITÁRIOS
// ---------------------------------------------------------------------
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
const fmt = n => Number(n).toFixed(1).replace('.', ',');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (nome, cls) => `<i data-lucide="${nome}" class="ic ${cls || ''}"></i>`;
const icones = () => { try { if (window.lucide) lucide.createIcons(); } catch (e) {} melhorarSelects(document); };
const ultima = id => { const l = estado.porSilo[id]; return l.length ? l[l.length - 1] : null; };
const siloPorId = id => SILOS.find(s => s.id === id);
const ruido = amp => (Math.random() * 2 - 1) * amp;
const corVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const dataSim = m => new Date(estado.inicioSim.getTime() + m * 60000);
const textoData = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const seloRisco = r => `<span class="selo ${r}"><i></i>${ROTULO[r]}</span>`;
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
function contaFaixa(f) { const h = { '1h': 1, '6h': 6, '24h': 24 }[f] || 6; return Math.max(6, Math.round(h * 60 / CFG.passo)); }
function dataBR(d) { return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; }

// ---------------------------------------------------------------------
// SIMULAÇÃO
// ---------------------------------------------------------------------
function gerarLeitura(silo, minuto) {
  const hora = (minuto / 60) % 24;
  const f = estado.falha[silo.id];
  f.nivel = f.ativa ? Math.min(1, f.nivel + f.sobe) : Math.max(0, f.nivel - SIM.falhaDesce);
  const ciclo = Math.sin(2 * Math.PI * (hora - SIM.horaPico + 6) / 24);   // pico às 15 h
  const tempSem = SIM.tempMedia + SIM.tempAmplitude * ciclo + silo.dTemp + ruido(SIM.ruidoTemp);
  let temp = tempSem + SIM.falhaTemp * f.nivel;
  let umid = SIM.umidBase - SIM.umidPorGrau * (tempSem - SIM.tempMedia) + silo.dUmid + ruido(SIM.ruidoUmid) + SIM.falhaUmid * f.nivel;
  temp = Math.round(temp * 10) / 10;
  umid = Math.min(100, Math.max(0, Math.round(umid * 10) / 10));
  const d = dataSim(minuto);
  return { timestamp: textoData(d), hora: `${pad(d.getHours())}:${pad(d.getMinutes())}`, dia: dataBR(d),
           silo: silo.id, temperatura: temp, umidade: umid, risco: calcularRisco(temp, umid) };
}

function guardarLeitura(silo, l) {
  estado.leituras.push(l);
  const lista = estado.porSilo[silo.id];
  lista.push(l);
  if (lista.length > SIM.maxPontos) lista.shift();
  verificarAlerta(silo, l);
}

function passo() {
  SILOS.forEach(silo => {
    if (live.ativo[silo.id]) return;      // sensor real mandando dados: não simula este silo
    guardarLeitura(silo, gerarLeitura(silo, estado.minutoSim));
  });
  estado.minutoSim += CFG.passo;
  estado.ultimoTick = new Date();
  notificar();
}

function iniciarTimer() {
  clearInterval(estado.timer);
  if (!estado.pausado) estado.timer = setInterval(passo, CFG.intervalo);
}

// ---------------------------------------------------------------------
// ALERTAS E AVISOS (toasts)
// ---------------------------------------------------------------------
// Quais medidas passaram do limite do nível atual (atenção ou perigo)
function fatores(l) {
  const lim = l.risco === 'vermelho' ? [CFG.tempPerigo, CFG.umidPerigo] : [CFG.tempAtencao, CFG.umidAtencao];
  return { lim, t: l.risco === 'vermelho' ? l.temperatura > lim[0] : l.temperatura >= lim[0], u: l.risco === 'vermelho' ? l.umidade > lim[1] : l.umidade >= lim[1] };
}
function motivoRisco(l) {
  const f = fatores(l), p = [];
  if (f.t) p.push(`Temperatura em ${fmt(l.temperatura)} °C — acima do limite de ${f.lim[0]} °C`);
  if (f.u) p.push(`Umidade em ${fmt(l.umidade)} % — acima do limite de ${f.lim[1]} %`);
  return p;
}

function verificarAlerta(silo, l) {
  const antes = estado.ultimoRisco[silo.id];
  estado.ultimoRisco[silo.id] = l.risco;
  if (antes === undefined) { estado.desde[silo.id] = l.hora; if (l.risco === 'verde') return; }
  else if (antes === l.risco) return;
  estado.desde[silo.id] = l.hora;
  const dados = `${fmt(l.temperatura)} °C e ${fmt(l.umidade)} %`;
  const melhorou = antes !== undefined && ORDEM[l.risco] < ORDEM[antes];
  let tipo, titulo, detalhe = dados;
  if (l.risco === 'verde') { tipo = 'normal'; titulo = `${silo.nome} voltou ao normal`; }
  else {
    tipo = l.risco === 'vermelho' ? 'perigo' : 'atencao';
    titulo = melhorou ? `${silo.nome} melhorou para ${NOMES_RISCO[l.risco]}` : `${silo.nome} entrou em ${NOMES_RISCO[l.risco]}`;
    const f = fatores(l), partes = [];
    if (f.t) partes.push(`temperatura acima de ${f.lim[0]} °C`);
    if (f.u) partes.push(`umidade acima de ${f.lim[1]} %`);
    if (partes.length) detalhe += ' — ' + partes.join(' e ');
  }
  novoAlerta({ tipo, titulo, detalhe, silo: silo.id, hora: l.hora, data: l.timestamp.slice(0, 10) });
}

function novoAlerta(a) {
  a.id = ++estado.alertaSeq; a.naoLido = true;
  estado.alertas.unshift(a);
  if (estado.alertas.length > SIM.maxAlertas) estado.alertas.pop();
  estado.naoLidos++;
  if (a.tipo !== 'normal' || CFG.avisos) {
    const tipoToast = a.tipo === 'perigo' ? 'perigo' : a.tipo === 'normal' ? 'ok' : 'atencao';
    toast(tipoToast, a.titulo, a.detalhe);
  }
  if (a.tipo === 'perigo' && CFG.sons) beep();
}

function toast(tipo, titulo, detalhe) {
  if (!CFG.avisos && tipo !== 'ok') return;
  const icone = tipo === 'perigo' ? 'flame' : tipo === 'ok' ? 'check' : 'alert-triangle';
  const el = document.createElement('div');
  el.className = 'toast ' + tipo;
  el.innerHTML = `<span class="t-ic">${ic(icone)}</span><div><b>${esc(titulo)}</b><span>${esc(detalhe || '')}</span></div><button type="button" aria-label="Fechar">${ic('x')}</button>`;
  $('toasts').prepend(el);
  icones();
  const fechar = () => el.remove();
  el.querySelector('button').onclick = fechar;
  setTimeout(fechar, 5000);
  while ($('toasts').children.length > 4) $('toasts').lastChild.remove();
}

function beep() {
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = new C(), o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.08;
    o.start(); o.stop(ctx.currentTime + 0.25);
  } catch (e) {}
}

// ---------------------------------------------------------------------
// SENSOR REAL (Wokwi) — leituras coladas do Serial Monitor
// ---------------------------------------------------------------------
const liveAtivo = id => !!live.ativo[id];

// Aceita "ms,silo,temp,umid,risco" (igual ao Serial Monitor) ou JSON {silo,temperatura,umidade}
function lerLinhaSensor(txt, siloForcado) {
  txt = String(txt).trim();
  if (!txt || /^timestamp|^erro|^aviso/i.test(txt)) return null;
  let silo, t, u, ms = NaN;
  if (txt[0] === '{') {
    try { const j = JSON.parse(txt); silo = j.silo; t = Number(j.temperatura); u = Number(j.umidade); } catch (e) { return null; }
  } else {
    const p = txt.split(',').map(s => s.trim());
    if (p.length < 4) return null;
    ms = parseFloat(p[0]); silo = p[1]; t = parseFloat(p[2]); u = parseFloat(p[3]);
  }
  silo = siloForcado || String(silo || 'A').toUpperCase();   // o silo escolhido na tela tem prioridade
  if (!siloPorId(silo) || !isFinite(t) || !isFinite(u)) return null;
  return { silo, t, u, ms };
}

function analisarSerial(txt, siloForcado) {
  const ok = []; let ign = 0;
  txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach(l => {
    if (/^timestamp/i.test(l)) return;
    const r = lerLinhaSensor(l, siloForcado);
    if (r) ok.push(r); else ign++;
  });
  return { ok, ign };
}

function registrarLeituraSensor(r, d) {
  const silo = siloPorId(r.silo);
  if (!live.ativo[silo.id]) { estado.porSilo[silo.id].length = 0; live.ativo[silo.id] = true; }  // gráfico começa só com dados do sensor
  live.total++;
  const t = Math.round(r.t * 10) / 10, u = Math.round(r.u * 10) / 10;
  guardarLeitura(silo, { timestamp: textoData(d), hora: `${pad(d.getHours())}:${pad(d.getMinutes())}`, dia: dataBR(d),
    silo: silo.id, temperatura: t, umidade: u, risco: calcularRisco(t, u), fonte: 'esp32' });
}

function importarSerial(texto, siloId) {
  const { ok } = analisarSerial(texto, siloId);
  if (!ok.length) { toast('atencao', 'Nenhuma linha válida', 'Use: timestamp_ms,silo,temperatura,umidade,risco'); return 0; }
  const ms = ok.map((r, i) => isFinite(r.ms) ? r.ms : i * 2000);
  const fim = Date.now(), ult = ms[ms.length - 1];
  ok.forEach((r, i) => registrarLeituraSensor(r, new Date(fim - (ult - ms[i]))));
  toast('ok', 'Leituras importadas', `${ok.length} leituras do sensor no ${siloPorId(siloId).nome}`);
  notificar();
  return ok.length;
}

function voltarSimulacao(id) {
  let algum = false;
  SILOS.forEach(s => { if ((!id || s.id === id) && live.ativo[s.id]) { live.ativo[s.id] = false; estado.porSilo[s.id].length = 0; algum = true; } });
  if (!SILOS.some(s => live.ativo[s.id])) live.total = 0;
  if (algum) toast('ok', 'Voltou à simulação', id ? `${siloPorId(id).nome} gera leituras simuladas de novo.` : 'Os silos geram leituras simuladas de novo.');
  notificar();
}

// ---------------------------------------------------------------------
// FALHA DE VENTILAÇÃO
// ---------------------------------------------------------------------
const falhaAtiva = () => SILOS.filter(s => estado.falha[s.id].ativa);
function iniciarFalha(id, intens) {
  estado.falha[id].ativa = true; estado.falha[id].sobe = INTENSIDADE[intens] || INTENSIDADE.media;
  toast('atencao', 'Falha de ventilação iniciada', `${siloPorId(id).nome}: temperatura e umidade vão subir aos poucos.`);
  renderAcoes(); notificar();
}
function normalizar() {
  SILOS.forEach(s => estado.falha[s.id].ativa = false);
  toast('ok', 'Falha encerrada', 'A ventilação voltou ao normal.');
  renderAcoes(); notificar();
}

// ---------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------
function montarCSV(silos, faixa) {
  let L = estado.leituras.filter(l => silos.includes(l.silo));
  if (faixa && faixa !== 'sessao') {
    const n = contaFaixa(faixa), cont = {}, manter = new Set();
    for (let i = L.length - 1; i >= 0; i--) { const s = L[i].silo; cont[s] = (cont[s] || 0) + 1; if (cont[s] <= n) manter.add(i); }
    L = L.filter((_, i) => manter.has(i));
  }
  const linhas = ['timestamp,silo,temperatura,umidade,risco'];
  L.forEach(l => linhas.push(`${l.timestamp},${l.silo},${l.temperatura.toFixed(1)},${l.umidade.toFixed(1)},${l.risco}`));
  return { texto: linhas.join('\n') + '\n', n: L.length };
}
function baixarCSV(silos, faixa) {
  const { texto, n } = montarCSV(silos || SILOS.map(s => s.id), faixa);
  if (!n) { toast('atencao', 'Sem leituras', 'Ainda não há leituras para baixar.'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
  a.download = 'graosafe_leituras.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('ok', 'CSV baixado', `${n} leituras exportadas.`);
}

// ---------------------------------------------------------------------
// COMPONENTES VISUAIS
// ---------------------------------------------------------------------
// Barra de zonas (verde/amarelo/vermelho) com o ponto do valor atual
function zonaBarra(v, min, max, at, pe, un) {
  const p = x => Math.max(0, Math.min(100, (x - min) / (max - min) * 100));
  const cor = v > pe ? 'vermelho' : v >= at ? 'amarelo' : 'verde';
  return `<div class="zona"><div class="trilho" style="--a:${p(at)}%;--b:${p(pe)}%"><i class="marca ${cor}" style="left:${p(v)}%"></i></div>
    <div class="zlab"><span style="left:0">${min}${un}</span><span style="left:${p(at)}%">${at}${un}</span><span style="left:${p(pe)}%">${pe}${un}</span><span style="left:100%">${max}${un}</span></div></div>`;
}

function spark(id, risco) {
  const l = estado.porSilo[id].slice(-24);
  if (l.length < 2) return '<svg class="spark"></svg>';
  const v = l.map(x => x.temperatura), mn = Math.min(...v), mx = Math.max(...v), w = 110, h = 30;
  const d = 'M' + v.map((y, i) => `${(i / (v.length - 1) * w).toFixed(1)} ${(h - 2 - (y - mn) / ((mx - mn) || 1) * (h - 4)).toFixed(1)}`).join(' L');
  const cor = { verde: '#16A34A', amarelo: '#EA6A12', vermelho: '#DC2626' }[risco];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" stroke="${cor}"/></svg>`;
}

function cartaoSilo(s) {
  const l = ultima(s.id);
  if (!l) return `<div class="card silo-card"><div class="sc-top"><h3>${s.nome}</h3></div><p class="msg">Aguardando primeira leitura…</p></div>`;
  const real = l.fonte === 'esp32';
  return `<a class="card silo-card ${l.risco}${estado.falha[s.id].ativa ? ' em-falha' : ''}" href="#/silo/${s.id}" aria-label="${s.nome}: ${ROTULO[l.risco]}">
    <div class="sc-top"><div><h3>${s.nome}</h3><small>${s.cultura}</small><span class="fonte ${real ? 'real' : ''}">${real ? 'Sensor ESP32' : 'Simulado'}</span></div>${seloRisco(l.risco)}</div>
    <div class="falha-tag">${ic('flame')} FALHA DE VENTILAÇÃO ATIVA</div>
    <div class="sc-vals">
      <div class="medida"><div class="lab t">${ic('thermometer')}Temperatura</div><div class="big f">${fmt(l.temperatura)}<small>°C</small></div>${zonaBarra(l.temperatura, 20, 40, CFG.tempAtencao, CFG.tempPerigo, '°')}</div>
      <div class="medida"><div class="lab u">${ic('droplet')}Umidade</div><div class="big f">${fmt(l.umidade)}<small>%</small></div>${zonaBarra(l.umidade, 40, 90, CFG.umidAtencao, CFG.umidPerigo, '%')}</div>
      ${spark(s.id, l.risco)}
    </div>
    <div class="sc-foot"><span>${ic('clock')}Última leitura ${l.hora}</span>${spark(s.id, l.risco)}</div>
  </a>`;
}

// ---------------------------------------------------------------------
// GRÁFICO (Chart.js) com linhas de limite
// ---------------------------------------------------------------------
const limitesPlugin = {
  id: 'limites',
  afterDatasetsDraw(ch) {
    const a = ch.chartArea, yT = ch.scales.yT; if (!yT) return;
    const ctx = ch.ctx; ctx.save(); ctx.lineWidth = 1.2;
    [[CFG.tempPerigo, '#DC2626', 'Perigo'], [CFG.tempAtencao, '#D97706', 'Atenção']].forEach(([v, c, t]) => {
      const y = yT.getPixelForValue(v); if (y < a.top || y > a.bottom) return;
      ctx.setLineDash([6, 5]); ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(a.left, y); ctx.lineTo(a.right, y); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = c; const tam = Math.round(((ch.options.font && ch.options.font.size) || 12) * 0.92); ctx.font = `600 ${tam}px Inter, sans-serif`; ctx.fillText(`${t} ${v}°`, a.left + 8, y - 5);
    });
    ctx.restore();
  }
};
function novoGrafico(canvas) {
  const t = corVar('--temp'), h = corVar('--hum'), mut = corVar('--muted'), gr = corVar('--line2'), fundo = corVar('--surface');
  const ultimoPonto = c => c.dataIndex === c.dataset.data.length - 1 ? 5 : 0;
  return new Chart(canvas, {
    type: 'line',
    data: { labels: [], datasets: [
      { label: 'Temperatura (°C)', data: [], yAxisID: 'yT', borderColor: t, backgroundColor: hexA(t, 0.12), fill: true, tension: 0.35, borderWidth: 2.5, pointRadius: ultimoPonto, pointBackgroundColor: fundo, pointBorderColor: t, pointBorderWidth: 3 },
      { label: 'Umidade (% UR)', data: [], yAxisID: 'yU', borderColor: h, tension: 0.35, borderWidth: 2.5, pointRadius: ultimoPonto, pointBackgroundColor: fundo, pointBorderColor: h, pointBorderWidth: 3 }
    ]},
    options: {
      responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
      font: { family: 'Inter, system-ui, sans-serif' },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0E1B16', padding: 12, cornerRadius: 10, callbacks: { label: c => `${c.dataset.label}: ${fmt(c.parsed.y)}` } } },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: mut, maxTicksLimit: 6 } },
        yT: { position: 'left', suggestedMin: 20, suggestedMax: 40, border: { display: false }, grid: { color: gr }, ticks: { stepSize: 5, color: t, callback: v => v + '°' } },
        yU: { position: 'right', suggestedMin: 40, suggestedMax: 85, border: { display: false }, grid: { drawOnChartArea: false }, ticks: { stepSize: 15, color: h, callback: v => v + '%' } }
      }
    },
    plugins: [limitesPlugin]
  });
}
function atualizarGrafico(ch, id, faixa) {
  if (!ch) return;
  const l = estado.porSilo[id].slice(-contaFaixa(faixa));
  ch.data.labels = l.map(x => x.hora);
  ch.data.datasets[0].data = l.map(x => x.temperatura);
  ch.data.datasets[1].data = l.map(x => x.umidade);
  ch.update();
}
const legendaGrafico = `<div class="legenda"><span><i style="background:var(--temp)"></i>Temperatura (°C)</span><span><i style="background:var(--hum)"></i>Umidade (% UR)</span><span><i style="background:none;border-top:2px dashed #D97706;height:0;border-radius:0;width:16px;vertical-align:3px"></i>Limites de risco</span></div>`;

function seg(nome, opcoes, atual) {
  return `<div class="seg" data-seg="${nome}">${opcoes.map(([v, t]) => `<button type="button" data-v="${v}" class="${v === atual ? 'on' : ''}">${t}</button>`).join('')}</div>`;
}
function onSeg(w, nome, fn) {
  w.addEventListener('click', e => {
    const b = e.target.closest(`[data-seg="${nome}"] button`); if (!b) return;
    b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    fn(b.dataset.v);
  });
}
function setHTML(el, html) { if (el && el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; } }

// ---------------------------------------------------------------------
// MENU SUSPENSO PRÓPRIO (substitui a lista nativa do <select>)
// O <select> original continua existindo (escondido) e recebe o valor e o evento "change".
// Cada <option> pode ter data-dot="verde|amarelo|vermelho" e data-meta="texto à direita".
// ---------------------------------------------------------------------
function melhorarSelects(raiz) {
  (raiz || document).querySelectorAll('select:not([data-dd])').forEach(sel => {
    sel.dataset.dd = '1';
    const dd = document.createElement('div');
    dd.className = 'dd';
    dd.innerHTML = `<button type="button" class="dd-btn" aria-haspopup="listbox" aria-expanded="false"><i class="dd-dot"></i><span class="dd-lab"></span>${ic('chevron-down', 'dd-chev')}</button>`;
    sel.classList.add('dd-native'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
    sel.insertAdjacentElement('afterend', dd);
    const btn = dd.querySelector('.dd-btn');
    if (sel.getAttribute('aria-label')) btn.setAttribute('aria-label', sel.getAttribute('aria-label'));
    let menu = null, idx = -1;

    const atualizar = () => {
      const o = sel.options[sel.selectedIndex];
      dd.querySelector('.dd-lab').textContent = o ? o.textContent : '';
      const dot = dd.querySelector('.dd-dot');
      dot.className = 'dd-dot' + (o && o.dataset.dot ? ' pt ' + o.dataset.dot : '');
      dot.style.display = o && o.dataset.dot ? '' : 'none';
    };
    const rolou = e => { if (!(menu && menu.contains(e.target))) fechar(); };
    const fora = e => { if (menu && !menu.contains(e.target) && !dd.contains(e.target)) fechar(); };
    function fechar() {
      if (menu) { menu.remove(); menu = null; }
      btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('mousedown', fora, true);
      window.removeEventListener('resize', fechar);
      window.removeEventListener('scroll', rolou, true);
    }
    const escolher = i => {
      sel.selectedIndex = i; atualizar(); fechar();
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      btn.focus();
    };
    const marcar = i => {
      idx = Math.max(0, Math.min(sel.options.length - 1, i));
      [...menu.children].forEach((li, k) => li.classList.toggle('foco', k === idx));
      menu.children[idx].scrollIntoView({ block: 'nearest' });
    };
    const abrir = () => {
      if (menu) return;
      menu = document.createElement('ul');
      menu.className = 'dd-menu'; menu.setAttribute('role', 'listbox');
      menu.innerHTML = [...sel.options].map((o, i) => `<li role="option" class="dd-opt${i === sel.selectedIndex ? ' sel' : ''}" data-i="${i}" aria-selected="${i === sel.selectedIndex}">${o.dataset.dot ? `<i class="pt ${esc(o.dataset.dot)}"></i>` : ''}<span class="dd-t">${esc(o.textContent)}</span>${o.dataset.meta ? `<small>${esc(o.dataset.meta)}</small>` : ''}${i === sel.selectedIndex ? ic('check', 'dd-ck') : ''}</li>`).join('');
      document.body.appendChild(menu);
      try { if (window.lucide) lucide.createIcons(); } catch (e) {}
      const r = (sel.closest('.selwrap') ? dd : btn).getBoundingClientRect();
      menu.style.minWidth = Math.max(r.width, 190) + 'px';
      const mw = menu.offsetWidth, mh = menu.offsetHeight;
      menu.style.left = Math.max(8, Math.min(r.left, innerWidth - mw - 8)) + 'px';
      menu.style.top = (r.bottom + mh + 14 > innerHeight && r.top > mh + 14 ? r.top - mh - 6 : r.bottom + 6) + 'px';
      btn.setAttribute('aria-expanded', 'true');
      menu.addEventListener('mousedown', e => e.preventDefault());
      menu.addEventListener('click', e => { const li = e.target.closest('.dd-opt'); if (li) escolher(Number(li.dataset.i)); });
      menu.addEventListener('mousemove', e => { const li = e.target.closest('.dd-opt'); if (li) marcar(Number(li.dataset.i)); });
      document.addEventListener('mousedown', fora, true);
      window.addEventListener('resize', fechar);
      window.addEventListener('scroll', rolou, true);
      marcar(sel.selectedIndex);
    };
    btn.addEventListener('click', () => (menu ? fechar() : abrir()));
    btn.addEventListener('keydown', e => {
      if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); if (!menu) abrir(); else marcar(idx + (e.key === 'ArrowDown' ? 1 : -1)); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!menu) abrir(); else escolher(idx); }
      else if (e.key === 'Escape' && menu) { e.stopPropagation(); fechar(); }
      else if (e.key === 'Tab') fechar();
    });
    atualizar();
  });
}

// ---------------------------------------------------------------------
// TELAS
// ---------------------------------------------------------------------
const RECS = {
  verde: [['check', 'Tudo certo', 'Continue monitorando as leituras.'], ['wind', 'Mantenha a ventilação', 'Rotina normal de aeração nos horários mais frescos.'], ['search', 'Inspeção de rotina', 'Faça uma inspeção visual periódica do grão.']],
  amarelo: [['wind', 'Aumente a ventilação', 'Ligue a aeração por 2 a 3 horas nos horários mais frescos.'], ['thermometer', 'Verifique pontos quentes', 'Confira se há acúmulo de calor em camadas profundas.'], ['search', 'Inspecione uma amostra', 'Retire uma amostra do silo e confira se há grão mofado.']],
  vermelho: [['flame', 'Ação imediata', 'Ligue toda a ventilação disponível agora.'], ['thermometer', 'Localize o foco de calor', 'Verifique camadas profundas e cantos do silo.'], ['search', 'Inspecione e separe o lote', 'Confira amostras do silo e isole os grãos mofados.']]
};

function itemAlerta(a, completo) {
  const icone = { atencao: 'alert-triangle', perigo: 'flame', normal: 'check' }[a.tipo];
  if (!completo) return `<div class="alert-item"><span class="al-ic ${a.tipo}">${ic(icone)}</span><div class="al-txt"><div class="al-top"><b>${esc(a.titulo)}</b><span class="al-hora">${a.hora}</span></div><span>${esc(a.detalhe)}</span></div></div>`;
  return `<div class="alert-item ${a.naoLido ? 'nao-lido' : ''}"><span class="al-ic ${a.tipo}">${ic(icone)}</span><div class="al-txt"><b>${esc(a.titulo)}</b><span>${esc(a.detalhe)}</span></div>
    ${a.silo ? `<span class="tag hide-m">${siloPorId(a.silo).nome}</span>` : ''}<span class="al-hora">${a.hora}</span>
    ${a.silo ? `<a class="btn sm" href="#/silo/${a.silo}">Ver silo</a>` : ''}</div>`;
}

// ===== Visão geral =====
function avisoHTML() {
  let h = '';
  const piores = SILOS.map(s => ({ s, l: ultima(s.id) })).filter(x => x.l && x.l.risco !== 'verde').sort((a, b) => ORDEM[b.l.risco] - ORDEM[a.l.risco]);
  if (piores.length) {
    const { s, l } = piores[0], m = motivoRisco(l);
    const extra = piores.length > 1 ? ` · mais ${piores.length - 1} silo(s) em alerta` : '';
    const dica = l.risco === 'vermelho' ? 'Aja agora: ventile e inspecione o lote.' : 'Aumente a ventilação para evitar mofo.';
    h += `<div class="aviso ${l.risco}" role="alert"><span class="a-ic">${ic(l.risco === 'vermelho' ? 'flame' : 'alert-triangle')}</span><div><b>${s.nome} em ${l.risco === 'vermelho' ? 'perigo' : 'atenção'}</b><span>${esc(m.join(' · '))}. ${dica}${extra}</span></div><a class="btn sm" href="#/silo/${s.id}">Ver recomendações ${ic('chevron-right')}</a></div>`;
  }
  const f = falhaAtiva();
  if (f.length) h += `<div class="aviso vermelho" role="alert"><span class="a-ic">${ic('flame')}</span><div><b>Falha de ventilação simulada ativa</b><span>${f.map(s => s.nome).join(', ')}: temperatura e umidade estão subindo.</span></div><button type="button" class="btn sm dng-fill" data-act="falha-fim">Encerrar falha</button></div>`;
  return h;
}

const VGeral = {
  titulo: () => 'Visão geral',
  sub: () => `Armazém de Rondonópolis · ${SILOS.length} silos monitorados`,
  acoes: () => ['pill', 'int', 'falha', 'pausar', 'tema'],
  mount(w) {
    this.silo = 'A'; this.faixa = '6h';
    w.innerHTML = `<div id="vg-aviso"></div><div class="kpis" id="vg-kpis"></div>
      <div class="so-m"><h2>Meus silos</h2><a class="link" href="#/silos">Ver todos</a></div>
      <div class="silos" id="vg-silos"></div>
      <div class="row2">
        <section class="card"><div class="card-head"><div><h2>Temperatura e umidade</h2><p class="sub">Últimas leituras · horário simulado</p></div>
          <div class="tabs-row">${seg('vgSilo', SILOS.map(s => [s.id, s.nome]), 'A')}${seg('vgFaixa', [['1h', '1 h'], ['6h', '6 h'], ['24h', '24 h']], '6h')}</div></div>
          <div class="grafico"><canvas id="vg-cv" aria-label="Gráfico de temperatura e umidade"></canvas></div>${legendaGrafico}</section>
        <section class="card mini"><div class="card-head" style="margin-bottom:4px"><div><h2>Alertas recentes</h2><p class="sub">Quando o risco muda de nível</p></div><a class="link" href="#/alertas">Ver todos ${ic('chevron-right')}</a></div><div id="vg-alertas"></div></section>
      </div>
      <p class="msg hide-m" id="vg-rel"></p>`;
    onSeg(w, 'vgSilo', v => { this.silo = v; this.update(); });
    onSeg(w, 'vgFaixa', v => { this.faixa = v; this.update(); });
    this.chart = novoGrafico($('vg-cv'));
    this.update();
  },
  update() {
    setHTML($('vg-aviso'), avisoHTML());
    const ls = SILOS.map(s => ({ s, l: ultima(s.id) })).filter(x => x.l);
    const seguros = ls.filter(x => x.l.risco === 'verde').length;
    const at = ls.filter(x => x.l.risco === 'amarelo').length, pe = ls.filter(x => x.l.risco === 'vermelho').length;
    const media = k => ls.length ? ls.reduce((a, x) => a + x.l[k], 0) / ls.length : 0;
    const maxo = k => ls.reduce((m, x) => (!m || x.l[k] > m.l[k]) ? x : m, null);
    const mt = maxo('temperatura'), mu = maxo('umidade'), ua = estado.alertas[0];
    $('vg-kpis').innerHTML = `
      <div class="card kpi"><div class="k-top"><span class="k-ic verde">${ic('database')}</span>Silos seguros</div><div class="k-val num">${seguros}<small>/ ${SILOS.length}</small></div><div class="k-sub">${at} em atenção · ${pe} em perigo</div></div>
      <div class="card kpi"><div class="k-top"><span class="k-ic laranja">${ic('thermometer')}</span>Temperatura média</div><div class="k-val num">${fmt(media('temperatura'))}<small>°C</small></div><div class="k-sub">${mt ? `Máx. ${fmt(mt.l.temperatura)} °C no ${mt.s.nome}` : '—'}</div></div>
      <div class="card kpi"><div class="k-top"><span class="k-ic azul">${ic('droplet')}</span>Umidade média</div><div class="k-val num">${fmt(media('umidade'))}<small>%</small></div><div class="k-sub">${mu ? `Máx. ${fmt(mu.l.umidade)} % no ${mu.s.nome}` : '—'}</div></div>
      <div class="card kpi"><div class="k-top"><span class="k-ic amarelo">${ic('bell')}</span>Alertas hoje</div><div class="k-val num">${estado.alertas.length}</div><div class="k-sub">${ua ? 'Último às ' + ua.hora : 'Nenhum alerta ainda'}</div></div>`;
    $('vg-silos').innerHTML = SILOS.map(cartaoSilo).join('');
    $('vg-alertas').innerHTML = estado.alertas.length ? estado.alertas.slice(0, 4).map(a => itemAlerta(a, false)).join('') : '<p class="vazio-txt">Nenhum alerta ainda.</p>';
    const d = dataSim(estado.minutoSim - CFG.passo);
    $('vg-rel').innerHTML = `${ic('clock', '')} Relógio simulado: <b>${dataBR(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}</b> · cada leitura avança ${CFG.passo} minutos`;
    atualizarGrafico(this.chart, this.silo, this.faixa);
  },
  unmount() { if (this.chart) this.chart.destroy(); this.chart = null; }
};

// ===== Lista de silos =====
const VSilos = {
  titulo: () => 'Silos', sub: () => 'Toque em um silo para ver os detalhes',
  acoes: () => ['pill', 'falha', 'tema'],
  mount(w) { w.innerHTML = '<div class="silos" id="ss-silos"></div>'; this.update(); },
  update() { $('ss-silos').innerHTML = SILOS.map(cartaoSilo).join(''); },
  unmount() {}
};

// ===== Detalhe do silo =====
const VSilo = {
  titulo: id => { const s = siloPorId(id); return `${s.nome} — ${s.cultura}`; },
  sub: () => 'Detalhes e histórico das leituras',
  crumb: id => `<div class="crumb"><a href="#/silos">Silos</a>${ic('chevron-right', 'hide-m')}<span class="hide-m">${siloPorId(id).nome}</span></div>`,
  acoes: () => ['pill', 'falha', 'csv', 'tema'],
  mount(w, id) {
    this.id = id; this.faixa = '6h';
    w.innerHTML = `<div class="row2 eq" id="sd-top"></div>
      <div class="row2">
        <section class="card"><div class="card-head"><div><h2>Histórico do silo</h2><p class="sub">Com faixas de risco destacadas</p></div>${seg('sdFaixa', [['1h', '1 h'], ['6h', '6 h'], ['24h', '24 h']], '6h')}</div>
          <div class="grafico"><canvas id="sd-cv"></canvas></div>${legendaGrafico}</section>
        <section class="card"><h2>O que fazer agora</h2><p class="sub" id="sd-recsub"></p><div class="passos" id="sd-recs" style="margin-top:16px"></div><div id="sd-meta" style="margin-top:20px;padding-top:16px;border-top:1px solid var(--line2)"></div></section>
      </div>
      <section class="card"><div class="card-head"><h2>Últimas leituras</h2><a class="link" href="#/dados">Ver todas ${ic('chevron-right')}</a></div><div class="t-scroll"><table class="tabela" id="sd-tab"></table></div></section>`;
    onSeg(w, 'sdFaixa', v => { this.faixa = v; this.update(); });
    this.chart = novoGrafico($('sd-cv'));
    this.update();
  },
  update() {
    const s = siloPorId(this.id), l = ultima(this.id); if (!l) return;
    const bloco = (rot, ico, cls, v, un, at, pe, mn, mx, txt, valor) => `<section class="card"><div class="card-head" style="margin-bottom:6px"><div class="medida"><div class="lab ${cls}">${ic(ico)}${rot}</div></div>${seloRisco(valor)}</div>
      <div class="big f" style="font-size:44px">${fmt(v)}<small style="font-size:22px">${un}</small></div>${zonaBarra(v, mn, mx, at, pe, un === '°C' ? '°' : '%')}<p class="sub" style="margin-top:12px">${txt}</p></section>`;
    const rT = l.temperatura > CFG.tempPerigo ? 'vermelho' : l.temperatura >= CFG.tempAtencao ? 'amarelo' : 'verde';
    const rU = l.umidade > CFG.umidPerigo ? 'vermelho' : l.umidade >= CFG.umidAtencao ? 'amarelo' : 'verde';
    $('sd-top').innerHTML =
      bloco('Temperatura', 'thermometer', 't', l.temperatura, '°C', CFG.tempAtencao, CFG.tempPerigo, 20, 40, `Atenção a partir de ${CFG.tempAtencao} °C · Perigo acima de ${CFG.tempPerigo} °C`, rT) +
      bloco('Umidade relativa', 'droplet', 'u', l.umidade, '%', CFG.umidAtencao, CFG.umidPerigo, 40, 90, `Atenção a partir de ${CFG.umidAtencao} % · Perigo acima de ${CFG.umidPerigo} %`, rU);
    $('sd-recsub').textContent = `Sugestões para o nível ${ROTULO[l.risco]}`;
    $('sd-recs').innerHTML = RECS[l.risco].map(([i, t, d]) => `<div class="passo"><span class="n">${ic(i)}</span><div><b>${t}</b><span>${d}</span></div></div>`).join('');
    const prefixo = { verde: 'Seguro desde', amarelo: 'Em atenção desde', vermelho: 'Em perigo desde' }[l.risco];
    $('sd-meta').innerHTML = `<div class="por-silo"><span style="color:var(--muted)">Cultura</span><b>${s.cultura}</b></div><div class="por-silo"><span style="color:var(--muted)">${prefixo}</span><b>${estado.desde[this.id] || l.hora}</b></div>`;
    const linhas = estado.porSilo[this.id].slice(-6).reverse();
    $('sd-tab').innerHTML = `<thead><tr><th>Horário</th><th>Temperatura</th><th>Umidade</th><th>Risco</th></tr></thead><tbody>${linhas.map(x => `<tr><td>${x.dia} ${x.hora}</td><td>${fmt(x.temperatura)} °C</td><td>${fmt(x.umidade)} %</td><td>${seloRisco(x.risco)}</td></tr>`).join('')}</tbody>`;
    atualizarGrafico(this.chart, this.id, this.faixa);
  },
  unmount() { if (this.chart) this.chart.destroy(); this.chart = null; }
};

// ===== Alertas =====
const FILTROS = { todos: () => true, perigo: a => a.tipo === 'perigo', atencao: a => a.tipo === 'atencao', normal: a => a.tipo === 'normal' };
const VAlertas = {
  titulo: () => 'Alertas', sub: () => 'Histórico de mudanças de risco e avisos do sistema',
  acoes: () => ['pill', 'lidos', 'csv', 'tema'],
  mount(w) {
    this.filtro = 'todos';
    w.innerHTML = `<div class="chips" id="al-chips" style="margin-bottom:18px"></div><div class="row2" style="grid-template-columns:minmax(0,1.9fr) minmax(0,1fr)"><section class="card" id="al-lista"></section><section class="card" id="al-resumo"></section></div>`;
    w.addEventListener('click', e => { const c = e.target.closest('[data-f]'); if (c) { this.filtro = c.dataset.f; this.update(); icones(); } });
    this.update();
  },
  update() {
    const A = estado.alertas, n = k => A.filter(FILTROS[k]).length;
    $('al-chips').innerHTML = [['todos', 'Todos'], ['perigo', 'Perigo'], ['atencao', 'Atenção'], ['normal', 'Normalizados']]
      .map(([k, t]) => `<button type="button" class="chip ${this.filtro === k ? 'on' : ''}" data-f="${k}">${t} <small>${n(k)}</small></button>`).join('');
    const lista = A.filter(FILTROS[this.filtro]);
    const hojeChave = textoData(new Date()).slice(0, 10), grupos = {};
    lista.forEach(a => (grupos[a.data] = grupos[a.data] || []).push(a));
    $('al-lista').innerHTML = lista.length ? Object.keys(grupos).map(k => {
      const d = new Date(k + 'T12:00:00'), nome = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }).toUpperCase();
      return `<div class="dia">${k === hojeChave ? 'Hoje · ' : ''}${nome}</div>${grupos[k].map(a => itemAlerta(a, true)).join('')}`;
    }).join('') : '<p class="vazio-txt">Nenhum alerta neste filtro.</p>';
    const tot = A.length || 1, barra = (rot, cor, v) => `<div class="resumo-row"><span><i class="pt" style="background:${cor};display:inline-block;margin-right:8px"></i>${rot}</span><b class="num">${v}</b></div><div class="barra-r"><i style="width:${v / tot * 100}%;background:${cor}"></i></div>`;
    $('al-resumo').innerHTML = `<h2>Resumo</h2><p class="sub" style="margin-bottom:16px">Alertas por nível</p>${barra('Perigo', '#EF4444', n('perigo'))}${barra('Atenção', '#F59E0B', n('atencao'))}${barra('Normalizados', '#22C55E', n('normal'))}
      <h2 style="margin:6px 0 8px">Por silo</h2>${SILOS.map(s => `<div class="por-silo"><span>${s.nome}</span><b class="num">${A.filter(a => a.silo === s.id).length}</b></div>`).join('')}`;
    icones();
  },
  unmount() {}
};

// ===== Sensor real =====
const VSensor = {
  titulo: () => 'Sensor real', sub: () => 'Escolha o silo e use as leituras do ESP32 simulado no Wokwi',
  acoes: () => ['pill', 'guia-wokwi', 'tema'],
  mount(w) {
    w.innerHTML = `<section class="card status-card" id="sn-status"></section>
      <div class="row2" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)">
        <div class="stack">
          <section class="card"><div class="card-head"><div><h2>Cole as leituras do Wokwi</h2><p class="sub">Uma leitura por linha, separada por vírgulas</p></div><span class="tag info">${ic('info')}&nbsp;Formato CSV</span></div>
            <div class="destino"><div><b>Silo que receberá os dados</b><span class="sub">Vale para todas as linhas coladas, mesmo que o Serial Monitor mostre outro silo</span></div><div class="selwrap" style="min-width:230px"><select class="field" id="sn-silo" aria-label="Silo que receberá os dados"></select></div></div>
            <textarea id="sn-txt" class="terminal" spellcheck="false" aria-label="Leituras do Serial Monitor" placeholder="timestamp_ms,silo,temperatura,umidade,risco&#10;12000,A,26.0,55.0,verde"></textarea>
            <div class="btns"><button type="button" class="btn primary" id="sn-imp">${ic('upload')}<span id="sn-imp-t">Importar leituras</span></button><button type="button" class="btn" id="sn-lim">Limpar</button><button type="button" class="btn ghost push" id="sn-vol">Voltar à simulação</button></div></section>
          <section class="card" id="sn-prev"></section>
        </div>
        <div class="stack">
          <section class="card"><h2>Como conectar</h2><div class="passos" style="margin-top:14px">
            <div class="passo"><span class="n">${ic('check')}</span><div><b>Rode a simulação no Wokwi</b><span>ESP32 + DHT22 imprimindo no Serial Monitor</span></div></div>
            <div class="passo"><span class="n">${ic('check')}</span><div><b>Copie as linhas do Serial Monitor</b><span>Formato CSV, com ou sem o cabeçalho</span></div></div>
            <div class="passo"><span class="n">3</span><div><b>Escolha o silo, cole e importe</b><span>O silo escolhido passa a usar o sensor</span></div></div></div></section>
          <section class="card"><h2>Fluxo dos dados</h2><div class="fluxo" style="margin-top:14px"><span class="no">${ic('cpu')}ESP32 + DHT22</span>${ic('chevron-right', 'sep')}<span class="no">${ic('file-text')}Serial CSV</span>${ic('chevron-right', 'sep')}<span class="no fim">${ic('layout-grid')}Painel</span></div></section>
        </div>
      </div>`;
    this.opcoesSilo();
    $('sn-silo').addEventListener('change', e => { ui.siloSensor = e.target.value; this.prev(); this.update(); });
    const t = $('sn-txt'); t.value = ui.serialTexto;
    t.addEventListener('input', () => { ui.serialTexto = t.value; this.prev(); });
    $('sn-imp').onclick = () => { if (importarSerial(t.value, ui.siloSensor)) { t.value = ''; ui.serialTexto = ''; this.prev(); this.opcoesSilo(); } };
    $('sn-lim').onclick = () => { t.value = ''; ui.serialTexto = ''; this.prev(); };
    $('sn-vol').onclick = () => voltarSimulacao(ui.siloSensor);
    this.prev(); this.update();
  },
  // lista de silos do seletor (ponto de risco + origem atual dos dados)
  opcoesSilo() {
    const s = $('sn-silo'); if (!s) return;
    s.innerHTML = SILOS.map(x => { const l = ultima(x.id); return `<option value="${x.id}" ${x.id === ui.siloSensor ? 'selected' : ''} ${l ? `data-dot="${l.risco}"` : ''} data-meta="${live.ativo[x.id] ? 'Sensor ESP32' : 'Simulado'}">${x.nome} — ${x.cultura}</option>`; }).join('');
    const dd = s.nextElementSibling; if (dd && dd.classList.contains('dd')) { dd.remove(); delete s.dataset.dd; s.classList.remove('dd-native'); }
    melhorarSelects(s.parentElement);
  },
  prev() {
    const { ok, ign } = analisarSerial($('sn-txt').value, ui.siloSensor);
    $('sn-imp-t').textContent = ok.length ? `Importar ${ok.length} ${ok.length === 1 ? 'leitura' : 'leituras'} no ${siloPorId(ui.siloSensor).nome}` : 'Importar leituras';
    $('sn-imp').disabled = !ok.length;
    $('sn-prev').innerHTML = ok.length || ign
      ? `<h2>Prévia da importação</h2><p class="sub" style="margin-bottom:12px">${ok.length} linhas válidas${ign ? ` · ${ign} ignorada${ign > 1 ? 's' : ''} (leitura inválida)` : ''}</p>
         <div class="t-scroll"><table class="tabela"><thead><tr><th>Tempo</th><th>Silo</th><th>Temperatura</th><th>Umidade</th><th>Risco</th></tr></thead><tbody>${ok.slice(0, 6).map(r => `<tr><td>${isFinite(r.ms) ? Math.round(r.ms / 1000) + ' s' : '—'}</td><td>${siloPorId(r.silo).nome}</td><td>${fmt(r.t)} °C</td><td>${fmt(r.u)} %</td><td>${seloRisco(calcularRisco(r.t, r.u))}</td></tr>`).join('')}</tbody></table></div>`
      : `<h2>Prévia da importação</h2><p class="sub">Cole as leituras acima para ver a prévia.</p>`;
    icones();
  },
  update() {
    const ids = SILOS.filter(s => live.ativo[s.id]).map(s => s.id);
    const st = $('sn-status'); if (!st) return;
    st.className = 'card status-card' + (ids.length ? ' on' : '');
    st.innerHTML = `<span class="s-ic">${ic(ids.length ? 'check' : 'plug')}</span><div><b>${ids.length ? 'Sensor em uso' : 'Sensor ainda não importado'}</b><div class="sub" style="margin:0">${ids.length ? `${ids.map(i => siloPorId(i).nome).join(', ')} usando dados do ESP32 (${live.total} leituras importadas)` : 'Todos os silos estão usando dados simulados'}</div></div>
      ${seg('snFonte', [['sim', 'Simulação'], ['real', 'Sensor real']], ids.length ? 'real' : 'sim')}`;
    $('sn-vol').disabled = !live.ativo[ui.siloSensor];
    $('sn-vol').textContent = `Voltar à simulação (${siloPorId(ui.siloSensor).nome})`;
    icones();
  },
  unmount() {}
};

// ===== Dados e CSV =====
const VDados = {
  titulo: () => 'Dados e CSV', sub: () => 'Exporte as leituras em CSV e gere o relatório',
  acoes: () => ['pill', 'relatorio', 'csv', 'tema'],
  mount(w) {
    w.innerHTML = `<div class="stats" id="dd-stats"></div>
      <div class="row2" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)">
        <section class="card"><h2>Prévia dos dados</h2><p class="sub" style="margin-bottom:12px">Mostrando as 7 leituras mais recentes</p><div class="t-scroll"><table class="tabela" id="dd-tab"></table></div></section>
        <div class="stack">
          <section class="card"><h2 style="margin-bottom:12px">Exportar CSV</h2>
            ${SILOS.map(s => `<label class="chk"><input type="checkbox" data-silo="${s.id}" checked> ${s.nome}</label>`).join('')}
            <p style="font-weight:600;margin:16px 0 6px">Período</p>
            <div class="selwrap"><select class="field" id="dd-per" aria-label="Período"><option value="sessao">Toda a sessão</option><option value="1h">Última hora</option><option value="6h">Últimas 6 h</option><option value="24h">Últimas 24 h</option></select><span class="chev">${ic('chevron-down')}</span></div>
            <button type="button" class="btn primary block" id="dd-baixar" style="margin-top:16px">${ic('download')}Baixar CSV</button></section>
          <section class="card"><h2>Relatório em PDF</h2><p class="sub" style="margin:4px 0 14px">Resumo da situação, gráficos, alertas e recomendações em formato A4, pronto para imprimir ou salvar.</p><button type="button" class="btn primary block" data-act="relatorio">${ic('file-text')}Gerar relatório</button></section>
        </div></div>`;
    $('dd-baixar').onclick = () => {
      const ids = [...w.querySelectorAll('[data-silo]:checked')].map(c => c.dataset.silo);
      if (!ids.length) { toast('atencao', 'Escolha um silo', 'Marque pelo menos um silo para exportar.'); return; }
      baixarCSV(ids, $('dd-per').value);
    };
    this.update();
  },
  update() {
    const L = estado.leituras, csv = montarCSV(SILOS.map(s => s.id), 'sessao').texto.length;
    const ini = L.length ? L[0] : null, fim = L.length ? L[L.length - 1] : null;
    $('dd-stats').innerHTML = [
      ['Leituras coletadas', L.length.toLocaleString('pt-BR'), 'Nesta sessão'],
      ['Silos', SILOS.length, SILOS.map(s => s.id).join(', ').replace(/, ([^,]*)$/, ' e $1')],
      ['Período simulado', `${fmt(Math.max(0, estado.minutoSim - 360 - CFG.passo) / 60 + 0).replace(',0', '')} h`.replace('.', ','), ini ? `${ini.dia} ${ini.hora} a ${fim.dia} ${fim.hora}` : '—'],
      ['Tamanho do CSV', csv > 1024 ? Math.round(csv / 1024) + ' KB' : csv + ' B', '5 colunas']
    ].map(([a, b, c]) => `<div class="card stat"><small>${a}</small><div class="big num">${b}</div><small>${c}</small></div>`).join('');
    $('dd-tab').innerHTML = `<thead><tr><th>Horário</th><th>Silo</th><th>Temp. (°C)</th><th>Umidade (%)</th><th>Risco</th></tr></thead><tbody>${L.slice(-7).reverse().map(l => `<tr><td>${l.dia} ${l.hora}</td><td>${siloPorId(l.silo).nome}</td><td>${fmt(l.temperatura)}</td><td>${fmt(l.umidade)}</td><td>${seloRisco(l.risco)}</td></tr>`).join('')}</tbody>`;
  },
  unmount() {}
};

// ===== Configurações =====
const VConfig = {
  titulo: () => 'Configurações', sub: () => 'Limites de risco, simulação e aparência',
  acoes: () => ['pill', 'restaurar', 'salvar', 'tema'],
  mount(w) {
    const d = this.d = { tempAtencao: CFG.tempAtencao, tempPerigo: CFG.tempPerigo, umidAtencao: CFG.umidAtencao, umidPerigo: CFG.umidPerigo, intervalo: CFG.intervalo, passo: CFG.passo, avisos: CFG.avisos, sons: CFG.sons };
    const bloco = (k, ico, tit, un, min, max, at, pe) => `<section class="card" data-k="${k}"><h2 style="display:flex;align-items:center;gap:8px;color:var(--ink)"><span style="color:var(--${k === 't' ? 'temp' : 'hum'})">${ic(ico)}</span>${tit}</h2><p class="sub">Arraste os pontos para ajustar os limites</p>
      <div class="dual"><div class="trilho"></div><input type="range" class="at" min="${min}" max="${max}" step="1" aria-label="Atenção a partir de"><input type="range" class="pe" min="${min}" max="${max}" step="1" aria-label="Perigo acima de"></div>
      <div class="duo"><div><label>Atenção a partir de</label><div class="campo-un"><input class="field num at" type="number" step="1" aria-label="Atenção a partir de (${un})"><span>${un}</span></div></div>
      <div><label>Perigo acima de</label><div class="campo-un"><input class="field num pe" type="number" step="1" aria-label="Perigo acima de (${un})"><span>${un}</span></div></div></div></section>`;
    w.innerHTML = `<div class="cfg-grid">${bloco('t', 'thermometer', 'Limites de temperatura', '°C', 20, 40)}${bloco('u', 'droplet', 'Limites de umidade', '%', 40, 90)}
      <section class="card"><h2>Simulação</h2><p class="sub">Controle como os dados são gerados</p>
        <p style="font-weight:600;margin:18px 0 8px">Intervalo entre leituras</p>${seg('cfgInt', [['2000', '2 s'], ['5000', '5 s'], ['10000', '10 s']], String(d.intervalo))}
        <p style="font-weight:600;margin:18px 0 8px">Passo do relógio simulado</p><div class="selwrap"><select class="field" id="cf-passo" aria-label="Passo do relógio simulado">${[5, 10, 30, 60].map(m => `<option value="${m}" ${m === d.passo ? 'selected' : ''}>${m} minutos por leitura</option>`).join('')}</select><span class="chev">${ic('chevron-down')}</span></div></section>
      <section class="card"><h2>Aparência e avisos</h2><p class="sub">Preferências da interface</p>
        <div class="cfg-row"><div><b>Tema escuro</b><small>Reduz o brilho da tela</small></div><label class="toggle"><input type="checkbox" id="cf-tema" aria-label="Tema escuro" ${document.documentElement.dataset.theme === 'dark' ? 'checked' : ''}><span></span></label></div>
        <div class="cfg-row"><div><b>Avisos na tela</b><small>Mostra um aviso quando o risco muda</small></div><label class="toggle"><input type="checkbox" id="cf-avisos" aria-label="Avisos na tela" ${d.avisos ? 'checked' : ''}><span></span></label></div>
        <div class="cfg-row"><div><b>Sons de alerta</b><small>Toca um som no nível Perigo</small></div><label class="toggle"><input type="checkbox" id="cf-sons" aria-label="Sons de alerta" ${d.sons ? 'checked' : ''}><span></span></label></div></section></div>
      <div class="btns only-m"><button type="button" class="btn" data-act="restaurar">Restaurar padrão</button><button type="button" class="btn primary" data-act="salvar">${ic('check')}Salvar alterações</button></div>
      <p class="nota">${ic('info')}Os limites são simplificados e servem apenas para fins didáticos, não substituem normas técnicas.</p>`;
    [['t', 'tempAtencao', 'tempPerigo', 20, 40], ['u', 'umidAtencao', 'umidPerigo', 40, 90]].forEach(([k, ka, kp, mn, mx]) => {
      const c = w.querySelector(`[data-k="${k}"]`), ra = c.querySelector('input[type=range].at'), rp = c.querySelector('input[type=range].pe'), na = c.querySelector('input.num.at'), np = c.querySelector('input.num.pe'), tr = c.querySelector('.trilho');
      const desenhar = () => { ra.value = na.value = d[ka]; rp.value = np.value = d[kp]; tr.style.setProperty('--a', (d[ka] - mn) / (mx - mn) * 100 + '%'); tr.style.setProperty('--b', (d[kp] - mn) / (mx - mn) * 100 + '%'); };
      const cl = v => Math.max(mn, Math.min(mx, Math.round(Number(v) || 0)));
      const defAt = v => { d[ka] = Math.min(cl(v), d[kp] - 1); desenhar(); };
      const defPe = v => { d[kp] = Math.max(cl(v), d[ka] + 1); desenhar(); };
      ra.oninput = () => defAt(ra.value); na.onchange = () => defAt(na.value);
      rp.oninput = () => defPe(rp.value); np.onchange = () => defPe(np.value);
      desenhar();
    });
    onSeg(w, 'cfgInt', v => d.intervalo = Number(v));
    $('cf-passo').onchange = e => d.passo = Number(e.target.value);
    $('cf-avisos').onchange = e => d.avisos = e.target.checked;
    $('cf-sons').onchange = e => { d.sons = e.target.checked; if (d.sons) beep(); };
    $('cf-tema').onchange = e => aplicarTema(e.target.checked ? 'dark' : 'light');
  },
  salvar() { Object.assign(CFG, this.d); salvarCfg(); iniciarTimer(); toast('ok', 'Configurações salvas', 'Os novos limites já valem para as próximas leituras.'); renderAcoes(); notificar(); },
  restaurar() { const t = CFG.tema; Object.assign(CFG, PADRAO, { tema: t }); salvarCfg(); iniciarTimer(); toast('ok', 'Padrão restaurado', 'Limites e simulação voltaram aos valores originais.'); rotear(); },
  update() {},
  unmount() {}
};

// ---------------------------------------------------------------------
// MODAIS
// ---------------------------------------------------------------------
function abrirModal(html) {
  $('modal-root').innerHTML = `<div class="overlay"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  icones();
  const f = $('modal-root').querySelector('button,input'); if (f) f.focus();
}
function fecharModal() { $('modal-root').innerHTML = ''; }
function abrirModalFalha(idInicial) {
  const op = SILOS.map(s => { const l = ultima(s.id); return `<option value="${s.id}" ${s.id === idInicial ? 'selected' : ''} ${l ? `data-dot="${l.risco}" data-meta="${fmt(l.temperatura)} °C"` : ''}>${s.nome} — ${s.cultura}</option>`; }).join('');
  abrirModal(`<div class="m-head"><span class="m-ic">${ic('flame')}</span><div><h2>Simular falha de ventilação</h2><p class="sub">Temperatura e umidade vão subir aos poucos.</p></div></div>
    <label for="mf-silo">Silo afetado</label><div class="selwrap"><select class="field" id="mf-silo">${op}</select><span class="chev">${ic('chevron-down')}</span></div>
    <label>Intensidade</label><div id="mf-int">${seg('mfInt', [['leve', 'Leve'], ['media', 'Média'], ['forte', 'Forte']], 'media')}</div>
    <div class="m-btns"><button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn dng-fill" id="mf-ok">${ic('flame')}Iniciar falha</button></div>`);
  let intens = 'media';
  const m = $('modal-root');
  onSeg(m, 'mfInt', v => intens = v);
  $('mf-ok').onclick = () => { const id = $('mf-silo').value; fecharModal(); iniciarFalha(id, intens); };
}
function abrirSheetMais() {
  const item = (href, i, t, d, act) => `<${act ? 'button type="button" data-act="' + act + '"' : 'a href="' + href + '"'} class="s-item"><span class="s-ic">${ic(i)}</span><span><b>${t}</b><small>${d}</small></span>${ic('chevron-right', 'chev')}</${act ? 'button' : 'a'}>`;
  const ov = document.createElement('div'); ov.className = 'sheet-ov';
  ov.innerHTML = `<div class="sheet" role="dialog" aria-label="Mais opções"><div class="grip"></div><h2>Mais opções</h2>
    ${item('#/sensor', 'cpu', 'Sensor real', 'Importar leituras do Wokwi')}${item('#/dados', 'database', 'Dados e CSV', 'Exportar leituras em CSV')}${item('#/config', 'sliders-horizontal', 'Configurações', 'Limites, simulação e tema')}${item('', 'file-text', 'Relatório em PDF', 'Gerar e imprimir', 'relatorio')}${item('', 'flame', 'Simular falha', 'Testar o alerta de risco', 'falha')}</div>`;
  document.body.appendChild(ov);
  icones();
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('a,button')) ov.remove(); });
}

// ---------------------------------------------------------------------
// CABEÇALHO, MENUS, ROTEADOR
// ---------------------------------------------------------------------
const VIEWS = { '': VGeral, silos: VSilos, silo: VSilo, alertas: VAlertas, sensor: VSensor, dados: VDados, config: VConfig };
let viewAtual = null, rotaAtual = '', argAtual = null;

function acaoHTML(k) {
  const tema = document.documentElement.dataset.theme === 'dark';
  switch (k) {
    case 'pill': return '<button type="button" class="pill" id="pill" data-act="pausar" aria-label="Pausar ou continuar"><i class="ponto"></i><span id="pill-t"></span></button>';
    case 'int': return `<div class="select desk">${ic('refresh-cw')}<select id="sel-int" aria-label="Intervalo de atualização">${[2000, 5000, 10000].map(v => `<option value="${v}" ${v === CFG.intervalo ? 'selected' : ''}>A cada ${v / 1000} s</option>`).join('')}</select></div>`;
    case 'falha': return falhaAtiva().length
      ? `<button type="button" class="btn dng-fill desk" data-act="falha-fim">${ic('check')}Encerrar falha</button>`
      : `<button type="button" class="btn dng desk" data-act="falha">${ic('flame')}Simular falha</button>`;
    case 'pausar': return `<button type="button" class="btn dark desk" data-act="pausar">${ic(estado.pausado ? 'play' : 'pause')}${estado.pausado ? 'Continuar' : 'Pausar'}</button>`;
    case 'relatorio': return `<button type="button" class="btn primary desk" data-act="relatorio">${ic('file-text')}Gerar relatório</button>`;
    case 'csv': return `<button type="button" class="btn desk" data-act="csv">${ic('download')}Baixar CSV</button>`;
    case 'lidos': return `<button type="button" class="btn desk" data-act="lidos">${ic('check')}Marcar como lidos</button>`;
    case 'guia-wokwi': return `<button type="button" class="btn desk" data-act="guia-wokwi">${ic('info')}Guia do Wokwi</button>`;
    case 'restaurar': return '<button type="button" class="btn desk" data-act="restaurar">Restaurar padrão</button>';
    case 'salvar': return `<button type="button" class="btn primary desk" data-act="salvar">${ic('check')}Salvar alterações</button>`;
    case 'tema': return `<button type="button" class="btn icon" data-act="tema" aria-label="${tema ? 'Mudar para tema claro' : 'Mudar para tema escuro'}" title="Alternar tema">${ic(tema ? 'sun' : 'moon')}</button>`;
  }
  return '';
}
function renderAcoes() {
  const el = $('acoes'); if (!el || !viewAtual) return;
  el.innerHTML = viewAtual.acoes(argAtual).map(acaoHTML).join('');
  icones(); atualizarPill();
}
function renderTopo() {
  const v = viewAtual;
  $('topo').className = 'topo' + (rotaAtual === '' ? ' inicio' : '');
  $('topo').innerHTML = `<div style="min-width:0">${v.crumb ? v.crumb(argAtual) : ''}
    ${rotaAtual === '' ? `<div class="mbrand"><img class="logo" src="assets/icone.svg" alt="" width="42" height="42"><div><b>Grao<span style="color:var(--primary)">Safe</span></b><small>Rondonópolis, MT</small></div></div>` : ''}
    <div class="t-tit"><h1>${esc(v.titulo(argAtual))}</h1><p class="sub">${esc(v.sub(argAtual))}</p></div></div><div class="acoes" id="acoes"></div>`;
  renderAcoes();
}
function atualizarPill() {
  const p = $('pill'); if (!p) return;
  const perigo = SILOS.some(s => { const l = ultima(s.id); return l && l.risco === 'vermelho'; });
  p.className = 'pill' + (estado.pausado ? ' pausado' : perigo ? ' perigo' : '');
  const t = estado.ultimoTick;
  $('pill-t').innerHTML = estado.pausado ? 'Pausado' : `Ao vivo<span class="hide-m"> · ${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}</span>`;
}
function atualizarMenus() {
  const nomeRota = rotaAtual;
  document.querySelectorAll('#side [data-rota]').forEach(a => a.classList.toggle('on', a.dataset.rota === nomeRota));
  $('sub-silos').innerHTML = SILOS.map(s => { const l = ultima(s.id); return `<a class="nav ${nomeRota === 'silo' && argAtual === s.id ? 'on' : ''}" href="#/silo/${s.id}"><i class="pt ${l ? l.risco : ''}"></i><span>${s.nome}</span><small>${s.cultura}</small></a>`; }).join('');
  const b = $('badge-alertas'); b.textContent = estado.naoLidos || ''; b.classList.toggle('zero', !estado.naoLidos);
  const comSensor = SILOS.filter(s => liveAtivo(s.id)).map(s => s.nome);
  const real = comSensor.length > 0;
  document.querySelectorAll('#seg-fonte button').forEach(x => x.classList.toggle('on', x.dataset.v === (real ? 'real' : 'sim')));
  $('fonte-txt').textContent = real ? `${comSensor.join(', ')} usando dados do ESP32 (Wokwi). Volte à simulação quando quiser.` : `Leituras simuladas a cada ${CFG.intervalo / 1000} s. Importe do Wokwi na aba Sensor real.`;
  const ativo = { '': 0, silos: 1, silo: 1, alertas: 2, sensor: 3, dados: 3, config: 3 }[nomeRota];
  $('bottom').innerHTML = [['#/', 'home', 'Início'], ['#/silos', 'database', 'Silos'], ['#/alertas', 'bell', 'Alertas']].map(([h, i, t], k) => `<a href="${h}" class="${ativo === k ? 'on' : ''}">${ic(i)}${t}</a>`).join('')
    + `<button type="button" data-act="mais" class="${ativo === 3 ? 'on' : ''}">${ic('more-horizontal')}Mais</button>`;
}

// Atualiza tudo que depende dos dados (chamado a cada leitura nova)
function notificar() {
  atualizarMenus(); atualizarPill();
  if (viewAtual && viewAtual.update) viewAtual.update();
  icones();
}

function rotear() {
  const h = location.hash.replace(/^#\/?/, '');
  let [nome, arg] = h.split('/');
  nome = nome || '';
  if (!VIEWS[nome] || (nome === 'silo' && !siloPorId(arg))) { nome = ''; arg = null; }
  if (viewAtual && viewAtual.unmount) viewAtual.unmount();
  viewAtual = VIEWS[nome]; rotaAtual = nome; argAtual = arg || null;
  const w = document.createElement('div');
  $('view').replaceChildren(w);
  renderTopo();
  viewAtual.mount(w, argAtual);
  atualizarMenus();
  icones();
  window.scrollTo(0, 0);
  $('view').classList.remove('view'); void $('view').offsetWidth; $('view').classList.add('view');
  document.title = `${viewAtual.titulo(argAtual)} — GraoSafe`;
}

function aplicarTema(t) {
  document.documentElement.setAttribute('data-theme', t);
  CFG.tema = t; salvarCfg();
  rotear();    // recria gráficos e ícones com as cores do novo tema
}

// ---------------------------------------------------------------------
// AÇÕES (cliques com data-act) e eventos globais
// ---------------------------------------------------------------------
const ACOES = {
  pausar() { estado.pausado = !estado.pausado; iniciarTimer(); renderAcoes(); atualizarPill(); },
  falha() { abrirModalFalha(rotaAtual === 'silo' ? argAtual : 'A'); },
  'falha-fim': normalizar,
  relatorio() { abrirRelatorio(); },
  csv() { baixarCSV(rotaAtual === 'silo' ? [argAtual] : null, 'sessao'); },
  lidos() { estado.naoLidos = 0; estado.alertas.forEach(a => a.naoLido = false); notificar(); },
  'guia-wokwi'() {
    abrirModal(`<div class="m-head"><span class="m-ic" style="background:var(--safe-bg);color:var(--safe)">${ic('cpu')}</span><div><h2>Guia do Wokwi</h2></div></div>
      <ol><li>No Wokwi, crie um projeto <b>ESP32</b> e cole os arquivos da pasta <b>wokwi/</b> (sketch.ino, diagram.json e libraries.txt).</li><li>Inicie a simulação e mexa no DHT22.</li>
      <li>Copie as linhas do <b>Serial Monitor</b> e cole aqui, em <b>Sensor real</b>.</li><li>Escolha o <b>silo que receberá os dados</b> e clique em <b>Importar</b>: ele passa a usar o sensor.</li></ol>
      <div class="m-btns"><button type="button" class="btn primary" data-fechar>Entendi</button></div>`);
  },
  salvar() { if (viewAtual === VConfig) VConfig.salvar(); },
  restaurar() { if (viewAtual === VConfig) VConfig.restaurar(); },
  tema() { aplicarTema(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); },
  mais: abrirSheetMais
};

document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]');
  if (a && ACOES[a.dataset.act]) { e.preventDefault(); ACOES[a.dataset.act](); return; }
  if (e.target.closest('[data-fechar]') || (e.target.classList && e.target.classList.contains('overlay'))) { fecharModal(); return; }
  // alternador "Fonte dos dados" (menu lateral e tela Sensor real)
  const sf = e.target.closest('[data-seg="fonte"] button, [data-seg="snFonte"] button');
  if (sf) {
    if (sf.dataset.v === 'sim') voltarSimulacao();
    else if (!SILOS.some(s => liveAtivo(s.id)) && rotaAtual !== 'sensor') location.hash = '#/sensor';
    else if (!SILOS.some(s => liveAtivo(s.id))) { const t = $('sn-txt'); if (t) t.focus(); }
    notificar();
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'sel-int') { CFG.intervalo = Number(e.target.value); salvarCfg(); iniciarTimer(); atualizarMenus(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { fecharModal(); const s = document.querySelector('.sheet-ov'); if (s) s.remove(); } });
window.addEventListener('hashchange', rotear);

// ---------------------------------------------------------------------
// INÍCIO
// ---------------------------------------------------------------------
passo();                // primeira leitura imediata
iniciarTimer();
rotear();
