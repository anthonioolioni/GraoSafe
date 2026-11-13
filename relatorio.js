'use strict';
/* =====================================================================
   GraoSafe — relatorio.js
   Gera o relatório A4 (2 páginas) em uma nova aba, pronto para imprimir
   ou salvar em PDF. Usa os dados e funções de app.js (carregado junto).
   ===================================================================== */

const ICONE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34D07A"/><stop offset="1" stop-color="#0F6B35"/></linearGradient></defs><rect width="512" height="512" rx="116" fill="url(#g)"/><path fill-rule="evenodd" d="M150 404V236C150 186 196 148 246 148S342 186 342 236V404Q342 420 326 420H166Q150 420 150 404Z M246 232C290 262 290 336 246 372C202 336 202 262 246 232Z" fill="#fff"/><path d="M246 268V352" stroke="#fff" stroke-width="9" stroke-linecap="round"/><path d="M246 300L268 282M246 322L224 304" stroke="#fff" stroke-width="9" stroke-linecap="round"/><g fill="none" stroke="#fff" stroke-width="15" stroke-linecap="round"><path d="M353.2,142.0 A34,34 0 0 1 385.8,172.4"/><path d="M354.3,110.0 A66,66 0 0 1 417.6,169.1" opacity=".7"/><path d="M355.4,78.1 A98,98 0 0 1 449.5,165.8" opacity=".4"/></g></svg>';

const RELATORIO_CSS = `
@page{size:A4;margin:12mm}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;background:#E6ECE8;color:#0E1B16;font:10pt/1.45 Inter,"Segoe UI",Arial,sans-serif}
.barra{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:14px;padding:10px 22px;background:#0A2A21;color:#fff}
.barra img{width:30px;height:30px}.barra b{font-size:14px}.barra span{color:#9DB7AB;font-size:12.5px}
.barra .esp{flex:1}
.barra button{font:600 13px Inter,Arial,sans-serif;border:0;border-radius:9px;padding:9px 16px;cursor:pointer}
.barra .p{background:#22C55E;color:#06301C}.barra .s{background:rgba(255,255,255,.12);color:#fff}
.folha{width:210mm;min-height:297mm;margin:20px auto;padding:12mm;background:#fff;box-shadow:0 6px 30px rgba(14,27,22,.18);display:flex;flex-direction:column}
.cab{display:flex;align-items:center;gap:14px;padding-bottom:10px;border-bottom:3px solid #15803D}
.cab img{width:17mm;height:17mm}
.cab .t{flex:1}.cab .marca{font-size:20pt;font-weight:700;letter-spacing:-.02em;line-height:1}.cab .marca i{font-style:normal;color:#15803D}
.cab .tit{font-size:11pt;font-weight:600;margin-top:3px;color:#34443D}
.cab .meta{text-align:right;font-size:8.5pt;color:#5B6B63;line-height:1.5}.cab .meta b{color:#0E1B16}
h2{margin:15px 0 7px;font-size:8.5pt;letter-spacing:.09em;text-transform:uppercase;color:#15803D;display:flex;align-items:center;gap:8px}
h2::after{content:"";flex:1;height:1px;background:#DDE6E0}
.banner{display:flex;align-items:center;gap:12px;margin-top:12px;padding:10px 14px;border-radius:9px;border:1px solid}
.banner b{font-size:11.5pt}.banner span{font-size:9.5pt}
.banner.verde{background:#E6F5EB;border-color:#A9DDBB;color:#14532D}.banner.amarelo{background:#FEF3C7;border-color:#F4D27A;color:#713F12}.banner.vermelho{background:#FEE2E2;border-color:#F5B5B5;color:#7F1D1D}
.dot{width:12px;height:12px;border-radius:50%;flex:none}.dot.verde{background:#16A34A}.dot.amarelo{background:#F59E0B}.dot.vermelho{background:#EF4444}
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:12px}
.kpi{border:1px solid #DDE6E0;border-radius:8px;padding:8px 10px;break-inside:avoid}.kpi small{display:block;color:#5B6B63;font-size:7.5pt}.kpi b{font-size:15pt;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.kpi em{font-style:normal;color:#5B6B63;font-size:7.5pt;display:block}
ul.pts{margin:0;padding-left:16px}ul.pts li{margin:3px 0}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.card{border:1px solid #DDE6E0;border-radius:9px;padding:9px 10px;break-inside:avoid}
.card .nome{display:flex;justify-content:space-between;align-items:flex-start;gap:6px}.card .nome b{font-size:11pt}.card .nome small{display:block;color:#5B6B63;font-size:7.5pt}
.s{display:inline-block;padding:1px 8px;border-radius:999px;font-size:7.5pt;font-weight:700;white-space:nowrap}.s.verde{background:#E6F5EB;color:#15803D}.s.amarelo{background:#FEF3C7;color:#92400E}.s.vermelho{background:#FEE2E2;color:#B91C1C}.s.ia{background:#E3ECFD;color:#1D4ED8}
.agora{margin:7px 0 6px;font-size:14pt;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.agora small{font-size:8pt;color:#5B6B63;font-weight:500;letter-spacing:0}
table{width:100%;border-collapse:collapse;font-size:8.3pt}
th{text-align:left;color:#5B6B63;font-weight:600;font-size:7.3pt;padding:2px 0 3px;border-bottom:1px solid #DDE6E0}td{padding:3px 0;border-bottom:1px solid #F0F3F1;font-variant-numeric:tabular-nums}
td.r,th.r{text-align:right}
.emp{display:flex;height:7px;border-radius:4px;overflow:hidden;background:#EEF1EE;margin:7px 0 4px}.emp i{display:block;height:100%}.emp .v{background:#16A34A}.emp .a{background:#F59E0B}.emp .p{background:#EF4444}
.leg{display:flex;justify-content:space-between;font-size:7.3pt;color:#5B6B63}
.tab-al th,.tab-al td{padding:4px 6px}.tab-al td{border-bottom:1px solid #EEF1EE}
.graf{break-inside:avoid;margin-bottom:6px}.graf .gt{display:flex;justify-content:space-between;align-items:center;margin-bottom:2px}.graf .gt b{font-size:10pt}.graf img{width:100%;display:block;border:1px solid #E5EAE6;border-radius:6px}
.lgd{display:flex;gap:14px;font-size:7.8pt;color:#34443D;margin:0 0 6px}.lgd i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}
.ia-l{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.ia-l div{border:1px solid #DDE6E0;border-radius:8px;padding:6px;font-size:7.8pt;break-inside:avoid}.ia-l img{width:100%;height:10mm;object-fit:cover;border-radius:5px;margin-bottom:4px}
.duas{display:grid;grid-template-columns:1.1fr 1fr;gap:12px}
.rec{display:flex;gap:8px;margin:5px 0}.rec .n{width:18px;height:18px;border-radius:50%;background:#E6F5EB;color:#15803D;font-weight:700;font-size:8pt;display:grid;place-items:center;flex:none}.rec b{display:block}.rec span{color:#5B6B63;font-size:8.5pt}
.nota{margin-top:6px;padding:7px 10px;border-radius:7px;background:#F3F5F2;color:#34443D;font-size:8pt}
.rodape{margin-top:auto;padding-top:8px;border-top:1px solid #DDE6E0;display:flex;justify-content:space-between;gap:10px;font-size:7.5pt;color:#6B7A73}
.vazio{color:#6B7A73;font-style:italic;font-size:9pt}
@media print{body{background:#fff}.barra{display:none}.folha{width:auto;min-height:271mm;margin:0;padding:0;box-shadow:none;break-after:page}.folha:last-of-type{break-after:auto}}
`;

// Gráfico em tema claro, desenhado fora da tela e convertido em imagem
function graficoRelatorio(lista) {
  const c = document.createElement('canvas'); c.width = 1500; c.height = 230;
  const ch = new Chart(c, {
    type: 'line',
    data: { labels: lista.map(x => x.hora), datasets: [
      { label: 'Temperatura (°C)', data: lista.map(x => x.temperatura), yAxisID: 'yT', borderColor: '#EA6A12', backgroundColor: 'rgba(234,106,18,.12)', fill: true, tension: 0.35, borderWidth: 5, pointRadius: 0 },
      { label: 'Umidade (% UR)', data: lista.map(x => x.umidade), yAxisID: 'yU', borderColor: '#2563EB', tension: 0.35, borderWidth: 5, pointRadius: 0 }
    ]},
    options: {
      responsive: false, animation: false, devicePixelRatio: 1, font: { family: 'Inter, Arial, sans-serif', size: 27 },
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#5B6B63', maxTicksLimit: 8 } },
        yT: { position: 'left', suggestedMin: 20, suggestedMax: 40, grid: { color: '#E5EAE6' }, ticks: { stepSize: 5, color: '#EA6A12', callback: v => v + '°' } },
        yU: { position: 'right', suggestedMin: 30, suggestedMax: 90, grid: { drawOnChartArea: false }, ticks: { stepSize: 15, color: '#2563EB', callback: v => v + '%' } }
      }
    },
    plugins: [limitesPlugin]
  });
  const img = c.toDataURL('image/png');
  ch.destroy();
  return img;
}

function estatisticasSilo(s) {
  const L = estado.leituras.filter(l => l.silo === s.id);
  if (!L.length) return null;
  const T = L.map(l => l.temperatura), U = L.map(l => l.umidade), media = v => v.reduce((x, y) => x + y, 0) / v.length;
  const cont = { verde: 0, amarelo: 0, vermelho: 0 }; L.forEach(l => cont[l.risco]++);
  const maior = k => L.reduce((m, l) => l[k] > m[k] ? l : m, L[0]);
  return {
    s, n: L.length, tMin: Math.min(...T), tMed: media(T), tMax: Math.max(...T), uMin: Math.min(...U), uMed: media(U), uMax: Math.max(...U),
    pct: { verde: cont.verde / L.length * 100, amarelo: cont.amarelo / L.length * 100, vermelho: cont.vermelho / L.length * 100 },
    foraSeguro: (cont.amarelo + cont.vermelho) / L.length * 100, picoT: maior('temperatura'), picoU: maior('umidade'), atual: L[L.length - 1],
    fonte: live.ativo[s.id] ? 'Sensor ESP32 (Wokwi)' : 'Simulação', lista: estado.porSilo[s.id]
  };
}

function relatorioHTML() {
  const agora = new Date();
  const emissao = agora.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  const codigo = `${agora.getFullYear()}${pad(agora.getMonth() + 1)}${pad(agora.getDate())}-${pad(agora.getHours())}${pad(agora.getMinutes())}`;
  const logo = 'data:image/svg+xml;utf8,' + encodeURIComponent(ICONE_SVG);
  const est = SILOS.map(estatisticasSilo).filter(Boolean);
  const L = estado.leituras, ini = L[0], fim = L[L.length - 1];
  const periodoTxt = `${ini.dia} ${ini.hora} a ${fim.dia} ${fim.hora}`;
  const horasSim = Math.max(0, (estado.minutoSim - 360 - CFG.passo) / 60);
  const media = k => L.reduce((x, l) => x + l[k], 0) / L.length;
  const nSeg = est.filter(e => e.atual.risco === 'verde').length, nAt = est.filter(e => e.atual.risco === 'amarelo').length, nPe = est.filter(e => e.atual.risco === 'vermelho').length;
  const pior = est.slice().sort((x, y) => ORDEM[y.atual.risco] - ORDEM[x.atual.risco] || y.foraSeguro - x.foraSeguro)[0];
  const piorRisco = pior.atual.risco;
  const alertasPerigo = estado.alertas.filter(a => a.tipo === 'perigo').length;

  const tituloBanner = { verde: 'Situação geral: todos os silos em condição segura', amarelo: 'Situação geral: atenção em pelo menos um silo', vermelho: 'Situação geral: perigo em pelo menos um silo' }[piorRisco];
  const detalheBanner = `${nSeg} de ${est.length} silos seguros · ${nAt} em atenção · ${nPe} em perigo` + (piorRisco !== 'verde' ? ` · mais crítico: ${pior.s.nome} (${fmt(pior.atual.temperatura)} °C e ${fmt(pior.atual.umidade)} %)` : '');

  // Principais pontos (gerados automaticamente a partir dos dados)
  const pontos = [];
  const picoT = est.reduce((m, e) => e.picoT.temperatura > m.l.temperatura ? { s: e.s, l: e.picoT } : m, { s: est[0].s, l: est[0].picoT });
  const picoU = est.reduce((m, e) => e.picoU.umidade > m.l.umidade ? { s: e.s, l: e.picoU } : m, { s: est[0].s, l: est[0].picoU });
  pontos.push(`Maior temperatura do período: <b>${fmt(picoT.l.temperatura)} °C</b> no ${picoT.s.nome}, em ${picoT.l.dia} às ${picoT.l.hora}. Maior umidade: <b>${fmt(picoU.l.umidade)} %</b> no ${picoU.s.nome}, em ${picoU.l.dia} às ${picoU.l.hora}.`);
  const maisFora = est.slice().sort((x, y) => y.foraSeguro - x.foraSeguro)[0];
  pontos.push(maisFora.foraSeguro > 0 ? `O <b>${maisFora.s.nome}</b> passou <b>${fmt(maisFora.foraSeguro)} %</b> do período fora da faixa segura (atenção ou perigo).` : 'Nenhum silo saiu da faixa segura durante o período.');
  const fa = falhaAtiva();
  if (fa.length) pontos.push(`Há uma <b>falha de ventilação simulada</b> em andamento no ${fa.map(s => s.nome).join(', ')}.`);
  if (ia.hist.length) { const ruins = ia.hist.filter(h => RUIM.test(h.classe)).length; pontos.push(`Foram feitas <b>${ia.hist.length}</b> checagens por IA; <b>${ruins}</b> indicaram grão mofado/ardido.`); }
  pontos.push(`Foram gerados <b>${estado.alertas.length}</b> alertas (${alertasPerigo} de perigo) no período.`);

  const cartao = e => `<div class="card"><div class="nome"><div><b>${e.s.nome}</b><small>${e.s.cultura} · ${esc(e.fonte)}</small></div><span class="s ${e.atual.risco}">${ROTULO[e.atual.risco]}</span></div>
    <div class="agora">${fmt(e.atual.temperatura)} <small>°C</small> &nbsp; ${fmt(e.atual.umidade)} <small>%</small></div>
    <table><thead><tr><th></th><th class="r">Mín.</th><th class="r">Média</th><th class="r">Máx.</th></tr></thead><tbody>
      <tr><td>Temp. (°C)</td><td class="r">${fmt(e.tMin)}</td><td class="r">${fmt(e.tMed)}</td><td class="r">${fmt(e.tMax)}</td></tr>
      <tr><td>Umid. (%)</td><td class="r">${fmt(e.uMin)}</td><td class="r">${fmt(e.uMed)}</td><td class="r">${fmt(e.uMax)}</td></tr></tbody></table>
    <div class="emp"><i class="v" style="width:${e.pct.verde}%"></i><i class="a" style="width:${e.pct.amarelo}%"></i><i class="p" style="width:${e.pct.vermelho}%"></i></div>
    <div class="leg"><span>Seguro ${Math.round(e.pct.verde)} %</span><span>Atenção ${Math.round(e.pct.amarelo)} %</span><span>Perigo ${Math.round(e.pct.vermelho)} %</span></div>
    <div class="leg" style="margin-top:3px">${e.n} leituras</div></div>`;

  const tipoRot = { perigo: ['vermelho', 'Perigo'], atencao: ['amarelo', 'Atenção'], normal: ['verde', 'Normalizado'], ia: ['ia', 'IA'] };
  const linhasAlerta = estado.alertas.slice(0, 9).map(a => {
    const [c, r] = tipoRot[a.tipo];
    return `<tr><td>${esc(a.data.slice(8, 10) + '/' + a.data.slice(5, 7))} ${a.hora}</td><td>${a.silo ? siloPorId(a.silo).nome : 'IA'}</td><td><span class="s ${c}">${r}</span></td><td>${esc(a.titulo)}</td><td>${esc(a.detalhe)}</td></tr>`;
  }).join('');
  const maisAlertas = estado.alertas.length > 9 ? `<p class="vazio" style="margin:4px 0 0">Mostrando os 9 alertas mais recentes de ${estado.alertas.length}.</p>` : '';

  const graficos = est.map(e => `<div class="graf"><div class="gt"><b>${e.s.nome} — ${e.s.cultura}</b><span class="s ${e.atual.risco}">${ROTULO[e.atual.risco]}</span></div><img alt="Gráfico de ${e.s.nome}" src="${graficoRelatorio(e.lista.slice(-contaFaixa('24h')))}"></div>`).join('');
  const iaHTML = ia.hist.length ? `<h2>Checagens por IA (Teachable Machine)</h2><div class="ia-l">${ia.hist.map(h => `<div>${h.img ? `<img alt="" src="${h.img}">` : ''}<b>${esc(h.classe)}</b><br>${h.p} % · ${h.hora}<br><span style="color:#6B7A73">${esc(h.origem)}</span></div>`).join('')}</div>` : '';

  const recs = RECS[piorRisco].map(([, t, d], i) => `<div class="rec"><span class="n">${i + 1}</span><div><b>${t}</b><span>${d}</span></div></div>`).join('');
  const fontes = SILOS.map(s => `${s.nome}: ${live.ativo[s.id] ? 'sensor ESP32 (Wokwi)' : 'simulação do painel'}`).join(' · ');
  const rodape = n => `<div class="rodape"><span>GraoSafe · Rondonópolis, MT</span><span>Projeto acadêmico — Computação Contemporânea e Inteligência Artificial</span><span style="white-space:nowrap">Página ${n} de 2</span></div>`;

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Relatório GraoSafe ${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${RELATORIO_CSS}</style></head><body>
<div class="barra"><img src="${logo}" alt=""><b>Relatório GraoSafe</b><span>Pré-visualização · na impressão, escolha "Salvar como PDF"</span><span class="esp"></span><button class="s" onclick="window.close()">Fechar</button><button class="p" onclick="window.print()">Imprimir / Salvar PDF</button></div>

<section class="folha">
  <div class="cab"><img src="${logo}" alt="Logo GraoSafe"><div class="t"><div class="marca">Grao<i>Safe</i></div><div class="tit">Relatório de armazenagem de grãos</div></div>
    <div class="meta"><b>Rondonópolis, MT</b><br>Emitido em ${esc(emissao)}<br>Período: ${esc(periodoTxt)}<br>Relatório nº ${codigo}</div></div>
  <div class="banner ${piorRisco}"><i class="dot ${piorRisco}"></i><div><b>${tituloBanner}</b><br><span>${esc(detalheBanner)}</span></div></div>
  <div class="kpis">
    <div class="kpi"><small>Leituras coletadas</small><b>${L.length.toLocaleString('pt-BR')}</b><em>${est.length} silos</em></div>
    <div class="kpi"><small>Período simulado</small><b>${fmt(horasSim).replace(',0', '')} h</b><em>${CFG.passo} min por leitura</em></div>
    <div class="kpi"><small>Temperatura média</small><b>${fmt(media('temperatura'))} °C</b><em>todos os silos</em></div>
    <div class="kpi"><small>Umidade média</small><b>${fmt(media('umidade'))} %</b><em>todos os silos</em></div>
    <div class="kpi"><small>Alertas gerados</small><b>${estado.alertas.length}</b><em>${alertasPerigo} de perigo</em></div>
  </div>
  <h2>Principais pontos</h2><ul class="pts">${pontos.map(p => `<li>${p}</li>`).join('')}</ul>
  <h2>Situação e estatísticas por silo</h2><div class="cards">${est.map(cartao).join('')}</div>
  <h2>Alertas do período</h2>
  ${linhasAlerta ? `<table class="tab-al"><thead><tr><th>Quando</th><th>Silo</th><th>Nível</th><th>Evento</th><th>Detalhe</th></tr></thead><tbody>${linhasAlerta}</tbody></table>${maisAlertas}` : '<p class="vazio">Nenhum alerta no período.</p>'}
  ${rodape(1)}
</section>

<section class="folha">
  <div class="cab"><img src="${logo}" alt=""><div class="t"><div class="marca">Grao<i>Safe</i></div><div class="tit">Relatório de armazenagem de grãos</div></div><div class="meta">Relatório nº ${codigo}<br>${esc(periodoTxt)}</div></div>
  <h2>Evolução de temperatura e umidade (últimas 24 h simuladas)</h2>
  <div class="lgd"><span><i style="background:#EA6A12"></i>Temperatura (°C)</span><span><i style="background:#2563EB"></i>Umidade (% UR)</span><span><i style="background:none;border-top:2px dashed #D97706;height:0;border-radius:0;width:14px;vertical-align:3px"></i>Limites de temperatura</span></div>
  ${graficos}
  ${iaHTML}
  <div class="duas">
    <div><h2>Recomendações${piorRisco === 'verde' ? '' : ' — ' + pior.s.nome}</h2>${recs}</div>
    <div><h2>Limites de risco usados</h2><table><thead><tr><th>Nível</th><th>Temperatura</th><th>Umidade</th></tr></thead><tbody>
      <tr><td><span class="s verde">Seguro</span></td><td>&lt; ${CFG.tempAtencao} °C</td><td>&lt; ${CFG.umidAtencao} %</td></tr>
      <tr><td><span class="s amarelo">Atenção</span></td><td>${CFG.tempAtencao} a ${CFG.tempPerigo} °C</td><td>${CFG.umidAtencao} a ${CFG.umidPerigo} %</td></tr>
      <tr><td><span class="s vermelho">Perigo</span></td><td>&gt; ${CFG.tempPerigo} °C</td><td>&gt; ${CFG.umidPerigo} %</td></tr></tbody></table>
      <p style="font-size:8pt;color:#5B6B63;margin:5px 0 0">O nível do silo é o mais grave entre temperatura e umidade.</p></div>
  </div>
  <div class="nota"><b>Metodologia e limitações.</b> Fontes dos dados: ${esc(fontes)}. As leituras simuladas seguem um ciclo diário com ruído e episódios de falha de ventilação; cada leitura avança ${CFG.passo} minutos no relógio simulado. Os limites acima são <b>simplificados, para fins didáticos</b>, e não substituem normas técnicas de armazenagem. Documento gerado automaticamente pelo painel GraoSafe.</div>
  ${rodape(2)}
</section>
</body></html>`;
}

function abrirRelatorio() {
  if (!estado.leituras.length) { toast('atencao', 'Sem leituras', 'Aguarde a primeira leitura para gerar o relatório.'); return; }
  const w = window.open('', '_blank');
  if (!w) { toast('atencao', 'Pop-up bloqueado', 'Permita pop-ups para este site e tente de novo.'); return; }
  try {
    w.document.open(); w.document.write(relatorioHTML()); w.document.close();
  } catch (e) { w.close(); toast('perigo', 'Não consegui gerar o relatório', String(e.message || e)); }
}
