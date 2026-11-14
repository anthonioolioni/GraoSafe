# Roteiro do relatório — GraoSafe

**Dupla:** ______________________  **Turma:** __________  **Data:** __________

**Problema local:** perda de grãos por mofo em silos e armazéns de Rondonópolis (MT) quando temperatura e umidade sobem.
**Solução:** GraoSafe — sensor + painel web + alertas + relatório em PDF.

---

## Etapa 1 — Nuvem (Google Drive)

**Conceito:** o Google Drive é um exemplo de **SaaS** (Software como Serviço): usamos o programa pelo navegador, sem instalar nada e sem cuidar de servidores. Permite **colaboração em tempo real**: a dupla edita o mesmo arquivo ao mesmo tempo, com histórico de versões e controle de quem pode ver ou editar.

**O que printar:**
- [ ] A pasta compartilhada da dupla com todos os arquivos (sketch.ino, diagram.json, CSV, relatório).
- [ ] A tela de compartilhamento mostrando os participantes e as permissões.
- [ ] (Opcional) Histórico de versões de um arquivo.

**Nossa explicação (preencher):**
______________________________________________________________

---

## Etapa 2 — IoT (Wokwi: ESP32 + DHT22)

**Conceito:** a **camada de percepção** da IoT é formada por sensores que medem o mundo físico. Aqui o DHT22 mede temperatura e umidade, o ESP32 lê os valores, decide o nível de risco e acende o LED correspondente (verde, amarelo ou vermelho), enviando os dados pela porta serial.

**O que printar:**
- [ ] O circuito completo no Wokwi (ESP32, DHT22, 3 LEDs e resistores).
- [ ] O Serial Monitor com as linhas em CSV (`timestamp_ms,silo,temperatura,umidade,risco`).
- [ ] Um print com o LED **verde** aceso e outro com o **vermelho** (alterando o DHT22).
- [ ] O trecho do código com a regra de risco.
- [ ] O painel com a seção **Sensor real** após importar as linhas do Serial Monitor: cartão do Silo A com a etiqueta "Sensor ESP32 (Wokwi)", ao lado do Wokwi rodando (prova da integração).

**Nossa explicação (preencher):**
______________________________________________________________

---

## Painel funcionando (integração)

**O que printar:**
- [ ] Os 3 cartões de silo em verde/amarelo.
- [ ] Após "Simular falha de ventilação": um silo em vermelho e o alerta na lista.
- [ ] O gráfico ao vivo.
- [ ] O link publicado no GitHub Pages: ______________________________
- [ ] O CSV baixado aberto no Excel e o relatório em PDF gerado.

---

## Conclusão (preencher)

- O que funcionou bem: ______________________________________
- Dificuldades: _____________________________________________
- Limitações (dados simulados, limites didáticos): _____________
- Como melhorar (sensores reais, envio via Wi-Fi, notificação por WhatsApp): _____________
