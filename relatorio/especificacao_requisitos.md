# Especificação de Requisitos

**PROJETO:** GraoSafe — Monitoramento de armazenagem de grãos

**EQUIPE:** Anthonio Olioni, Enzo Cesar, Pedro Guilherme, Gustavo Vinicius e André Rufino

---

## 1. DESCRIÇÃO INFORMAL

O GraoSafe monitora a temperatura e a umidade dentro de silos de grãos e avisa quando as condições ficam perigosas. Ele é voltado a pequenos e médios produtores e armazéns de Rondonópolis (MT), onde o calor intenso favorece o mofo e a perda de soja e milho, e o problema muitas vezes só é percebido quando o grão já estragou. Um sensor ligado a um ESP32 mede o ambiente e acende um LED (verde, amarelo ou vermelho); um painel web mostra os silos, gera alertas e emite um relatório em PDF.

## 2. ARQUITETURA (4 camadas da IoT)

- **Percepção:** ESP32 + sensor DHT22 (temperatura e umidade) + 3 LEDs (verde, amarelo e vermelho), cada um com resistor de 220 Ω.
- **Rede:** Monitor Serial do Wokwi, que imprime as leituras em formato CSV. As linhas são copiadas e coladas no painel web, simulando o envio dos dados.
- **Processamento:** regra SE...ENTÃO no próprio ESP32 (calcula o nível de risco) e no painel web (alertas, gráficos e estatísticas).
- **Aplicação:** LED aceso no circuito; painel web com cartões, alertas, gráficos, download de CSV e relatório em PDF.
- **Premissas:**
  - O Wokwi simula o ESP32 e o DHT22; a temperatura e a umidade são ajustadas à mão clicando no sensor.
  - Apenas um sensor existe no simulador. Para o painel mostrar 3 silos, os dados são simulados por software, e o usuário escolhe qual silo recebe as leituras do ESP32.
  - Tentamos enviar os dados por Wi-Fi/MQTT, mas a rede do simulador não conectou no nosso ambiente. Por isso a Rede é o Monitor Serial.
  - Os limites de risco são simplificados, para fins didáticos, e não substituem normas técnicas.

## 3. REQUISITOS FUNCIONAIS (o que o sistema DEVE fazer)

**ESP32 (Wokwi)**

- **RF01:** O sistema deve ler o DHT22 (temperatura e umidade) a cada 2 segundos.
- **RF02:** O sistema deve classificar a leitura em um nível de risco e acender o LED correspondente:
  - Verde (Seguro): temperatura < 28 °C **e** umidade < 65 %.
  - Amarelo (Atenção): temperatura de 28 a 32 °C **ou** umidade de 65 a 75 %.
  - Vermelho (Perigo): temperatura > 32 °C **ou** umidade > 75 %.
- **RF03:** Quando as condições voltarem ao normal, o sistema deve acender o LED verde e apagar os outros. Só um LED fica aceso por vez.
- **RF04:** O sistema deve mostrar no Monitor Serial uma linha por leitura no formato `timestamp_ms,silo,temperatura,umidade,risco` (por exemplo, `12000,A,26.0,55.0,verde`).

**Painel web**

- **RF05:** O painel deve mostrar, para 3 silos, a temperatura, a umidade e o nível de risco (com texto, não só cor), atualizados a cada 5 segundos.
- **RF06:** O painel deve gerar um alerta sempre que o risco de um silo mudar de nível (inclusive quando voltar ao normal).
- **RF07:** O painel deve permitir simular uma falha de ventilação em um silo escolhido e encerrá-la depois.
- **RF08:** O painel deve permitir colar as linhas do Monitor Serial, escolher o silo que receberá os dados e importá-las.
- **RF09:** O painel deve baixar todas as leituras em CSV com o cabeçalho `timestamp,silo,temperatura,umidade,risco`.
- **RF10:** O painel deve gerar um relatório de 2 páginas em PDF, com situação geral, estatísticas por silo, alertas, gráficos e recomendações.
- **RF11:** O painel deve permitir mudar os limites de risco e alternar entre tema claro e escuro.

## 4. REQUISITOS NÃO FUNCIONAIS (restrições)

- **RNF01 (Pinagem):** DHT22 no GPIO 15 (alimentação 3V3 e GND); LED verde no GPIO 25, amarelo no GPIO 26 e vermelho no GPIO 27, cada um com resistor de 220 Ω.
- **RNF02 (Linguagem):** ESP32 programado em Arduino C++, só com bibliotecas disponíveis no Wokwi (`DHT sensor library` e `Adafruit Unified Sensor`). O painel usa HTML, CSS e JavaScript, sem servidor e sem banco de dados.
- **RNF03 (Robustez):** leitura inválida do sensor (`NaN`) não trava o sistema; ele mostra a mensagem "ERRO: leitura invalida do DHT22" e tenta de novo na próxima leitura. Linhas inválidas coladas no painel são ignoradas e contadas.
- **RNF04 (Acesso):** o painel abre com duplo clique no `index.html` e também pode ser publicado no GitHub Pages.
- **RNF05 (Usabilidade):** o painel funciona em computador e celular, sem rolagem horizontal, com interface em português do Brasil.

## 5. CRITÉRIOS DE ACEITAÇÃO (um por RF)

- **CA01 (RF01):** Dado o Wokwi em execução, quando eu abrir o Monitor Serial, então uma nova linha de leitura aparece a cada 2 segundos.
- **CA02 (RF02):** Dado o DHT22 em 26 °C e 55 %, quando eu mudar a temperatura para 33 °C, então o LED vermelho acende em até 2 segundos.
- **CA03 (RF03):** Dado o LED vermelho aceso, quando eu voltar a temperatura para 26 °C, então o LED verde acende e o vermelho apaga em até 2 segundos.
- **CA04 (RF04):** Dado o Monitor Serial aberto, quando uma leitura é feita, então a linha impressa tem 5 campos separados por vírgula, na ordem `timestamp_ms,silo,temperatura,umidade,risco`.
- **CA05 (RF05):** Dado o `index.html` aberto no navegador, então em até 5 segundos aparecem os 3 silos com temperatura, umidade e selo de risco com texto.
- **CA06 (RF06):** Dado um silo em "Seguro", quando eu iniciar uma falha de ventilação nele, então em até 1 minuto o silo chega a "Perigo" e um alerta aparece na lista e como aviso na tela.
- **CA07 (RF07):** Dada uma falha ativa, quando eu clicar em "Encerrar falha", então a faixa de aviso desaparece e o silo volta aos poucos ao normal.
- **CA08 (RF08):** Dadas 3 linhas válidas coladas e o Silo B escolhido, quando eu clicar em "Importar", então o cartão do Silo B mostra "Sensor ESP32" e os valores colados, e os outros silos continuam simulados.
- **CA09 (RF09):** Dado o painel com leituras, quando eu clicar em "Baixar CSV", então um arquivo é baixado, abre no Excel e tem o cabeçalho `timestamp,silo,temperatura,umidade,risco`.
- **CA10 (RF10):** Dado o painel com leituras, quando eu clicar em "Gerar relatório", então abre uma nova aba com o relatório de 2 páginas e o botão "Imprimir / Salvar PDF".
- **CA11 (RF11):** Dado o tema claro, quando eu clicar no botão de tema, então a interface muda para o escuro e a escolha continua ao recarregar a página; quando eu mudar um limite em Configurações e salvar, então o nível de risco das próximas leituras usa o novo valor.
