# GraoSafe — Especificação para o Claude Code

> Cole este arquivo na raiz de uma pasta vazia e peça ao Claude Code:
> **"Leia o ESPECIFICACAO_GraoSafe.md e implemente tudo, seguindo a ordem das fases."**

## 1. Contexto

Projeto da disciplina Computação Contemporânea e Inteligência Artificial (Módulo 5, atividade prática). A atividade tem 4 etapas: Nuvem (Google Drive), IoT (Wokwi com ESP32 e DHT22), Dados (Google Colab) e IA (Teachable Machine). O professor pediu um projeto que resolva uma **dor local de Rondonópolis (MT)**.

**Dor local:** Rondonópolis é um polo do agronegócio (soja e milho) e tem calor intenso. Pequenos e médios produtores e armazéns perdem grãos por mofo e fungos quando temperatura e umidade sobem dentro do depósito. Muitas vezes o problema só é percebido quando o grão já estragou.

**Solução: GraoSafe** — monitoramento de armazenagem de grãos com sensor, painel web, análise de dados e IA para checar a qualidade do grão.

## 2. Princípios

- **Simples e fácil de acessar:** um site estático, sem backend, sem banco de dados, sem build, sem login. Deve abrir com duplo clique no `index.html` e também ficar online pelo GitHub Pages.
- Interface em **português do Brasil**, comentários no código em português, linguagem simples.
- Funciona bem no celular e no computador (responsivo).
- O projeto deve ser **fácil de explicar numa apresentação** de poucos minutos.

## 3. Entregáveis

```
graosafe/
├── index.html          # painel web (HTML + CSS + JS, tudo em um arquivo)
├── README.md           # o que é, como abrir, como publicar no GitHub Pages
├── wokwi/
│   ├── sketch.ino      # código do ESP32 + DHT22
│   ├── diagram.json    # circuito do Wokwi
│   └── libraries.txt   # bibliotecas do Wokwi
├── colab/
│   └── analise_graosafe.ipynb   # análise exploratória + regressão
├── dados/
│   └── exemplo_graosafe.csv     # CSV de exemplo (gerado pela simulação)
└── relatorio/
    └── roteiro_relatorio.md     # roteiro do relatório com o que printar em cada etapa
```

## 4. Fase 1 — Painel web (`index.html`)

Um único arquivo. Bibliotecas apenas por CDN (Chart.js). Nenhum framework.

### 4.1 Simulação dos dados

- Simular **3 silos** (nomes: "Silo A — Soja", "Silo B — Milho", "Silo C — Soja"). Cada silo tem uma leitura nova a cada **5 segundos** (intervalo configurável: 2s, 5s, 10s).
- Cada leitura tem: `timestamp`, `silo`, `temperatura` (°C), `umidade` (% UR), `risco`.
- A temperatura segue um **ciclo diário** (mais quente à tarde, mais fria de madrugada) com ruído aleatório pequeno. Faixa base: 24 a 36 °C. A umidade varia de forma aproximadamente inversa à temperatura, na faixa de 45 a 85 %.
- Para a demonstração não ficar parada, o relógio simulado deve **andar mais rápido** que o real: cada leitura avança 10 minutos no tempo simulado (assim um ciclo de 24 h aparece em poucos minutos).
- Cada silo tem um deslocamento próprio (ex.: o Silo C é um pouco mais quente e úmido), para os silos serem diferentes.
- Botão **"Simular falha de ventilação"**: escolhe um silo e faz temperatura e umidade subirem gradualmente por alguns ciclos, para mostrar o alerta funcionando. Botão para voltar ao normal.

### 4.2 Regra de risco (didática, configurável no topo do JS)

| Risco | Condição |
|---|---|
| Verde (Seguro) | temperatura < 28 °C **e** umidade < 65 % |
| Amarelo (Atenção) | temperatura entre 28 e 32 °C **ou** umidade entre 65 e 75 % |
| Vermelho (Perigo) | temperatura > 32 °C **ou** umidade > 75 % |

Deixar claro na página, em uma nota pequena, que são limites **simplificados para fins didáticos**, não uma norma técnica.

### 4.3 Interface

- **Cabeçalho:** nome "GraoSafe", subtítulo "Monitoramento de armazenagem de grãos — Rondonópolis, MT", indicador "Atualizado às HH:MM:SS" e botão pausar/continuar.
- **Cartões dos silos** (um por silo): temperatura atual, umidade atual, selo de risco colorido e mini texto com a hora da última leitura.
- **Gráfico de linhas ao vivo** (Chart.js): temperatura e umidade ao longo do tempo, com seletor de silo. Mostrar as últimas 60 leituras.
- **Painel de alertas:** lista com hora, silo e mensagem (ex.: "Silo B entrou em PERIGO: 33,4 °C e 78 %"). Gerar alerta apenas quando o risco **muda** de nível. Máximo de 20 itens visíveis.
- **Botão "Baixar CSV":** baixa todas as leituras da sessão. Formato do CSV: `timestamp,silo,temperatura,umidade,risco` (ponto como separador decimal, vírgula como separador de campos, cabeçalho na primeira linha). O mesmo formato será usado pelo Wokwi e pelo Colab.
- **Seção "Checagem do grão (IA)":** ver Fase 4.
- Visual limpo, tema escuro opcional não é necessário. Cores de risco: verde, amarelo e vermelho acessíveis (não depender só da cor, o selo também tem texto).
- Rodapé: "Projeto acadêmico — Computação Contemporânea e Inteligência Artificial".

### 4.4 Critérios de aceite

- Abrir o `index.html` direto no navegador funciona (sem servidor).
- As leituras aparecem e o gráfico se atualiza sozinho.
- O botão de falha faz um silo chegar ao vermelho e gera alerta.
- O CSV baixado abre corretamente no Excel/Colab.
- Usável em tela de celular (sem rolagem horizontal).

## 5. Fase 2 — IoT no Wokwi (`wokwi/`)

- Placa: **ESP32 DevKit C V4**. Sensor: **DHT22** no pino de dados GPIO 15 (alimentação 3V3 e GND). Três LEDs (verde, amarelo, vermelho) nos GPIO 25, 26 e 27, cada um com resistor de 220 Ω.
- Biblioteca: `DHT sensor library` (Adafruit) — listar em `libraries.txt`.
- Lógica: ler temperatura e umidade a cada 2 segundos, aplicar **as mesmas regras de risco** da seção 4.2, acender o LED correspondente e imprimir no Serial Monitor em formato CSV:
  `timestamp_ms,silo,temperatura,umidade,risco` (silo fixo "A").
- Tratar leitura inválida (`isnan`) imprimindo uma mensagem de erro e continuando.
- Fornecer `diagram.json` válido para colar no Wokwi e um passo a passo curto no README (criar projeto ESP32, colar os arquivos, iniciar a simulação, ajustar o DHT22 clicando nele).

## 6. Fase 3 — Dados no Colab (`colab/analise_graosafe.ipynb`)

Notebook em português, com células curtas e comentadas, que:

1. Faz upload ou lê o CSV (`dados/exemplo_graosafe.csv`, também pode ser lido por link do Google Drive).
2. **Análise exploratória:** `head`, `describe`, contagem de leituras por risco, gráfico de linha da temperatura e umidade por silo, histograma e boxplot por silo, mapa de correlação (heatmap).
3. **Regressão linear** (scikit-learn): prever a umidade a partir da temperatura (e da hora do dia, se disponível). Dividir treino e teste, mostrar R², MAE, gráfico de dispersão com a reta e uma pequena célula "prever umidade para X °C".
4. **Conclusão em texto** (markdown) explicando o resultado em linguagem simples e ligando ao problema do mofo.

O Claude Code deve **gerar o `exemplo_graosafe.csv`** com um script Python (cerca de 1500 linhas, 3 silos, ciclo diário, ruído e alguns episódios de falha) usando a mesma lógica da simulação do painel, e conferir que o notebook roda do início ao fim (executar com `nbconvert` ou equivalente).

## 7. Fase 4 — IA com Teachable Machine (integração)

O treino do modelo é feito **pelos alunos** em teachablemachine.withgoogle.com (projeto de imagens, 2 classes: "Grão saudável" e "Grão mofado/ardido", ~30 fotos por classe, usando webcam ou imagens). O Claude Code só prepara a integração:

- Na seção "Checagem do grão (IA)" do `index.html`: campo de texto para colar a **URL do modelo** exportado (formato `https://teachablemachine.withgoogle.com/models/XXXX/`), botão "Carregar modelo", ativação da webcam ou envio de uma foto, e exibição das probabilidades das classes em barras.
- Usar a biblioteca oficial `@teachablemachine/image` via CDN (com TensorFlow.js).
- Sem URL carregada, mostrar uma mensagem amigável explicando como treinar e exportar o modelo.
- Integração com o painel: se a IA classificar "mofado" com probabilidade acima de 70 %, mostrar um alerta no painel de alertas.
- Tratar erros (sem câmera, URL inválida) com mensagens claras.

## 8. Fase 5 — Nuvem e relatório

- `relatorio/roteiro_relatorio.md`: roteiro do relatório por etapa (Nuvem, IoT, Dados, IA), com **o que printar** em cada uma (a pasta compartilhada no Drive com os arquivos, o circuito e o Serial Monitor do Wokwi, os gráficos e a regressão do Colab, a tela do Teachable Machine e o painel funcionando), uma explicação curta do conceito de cada etapa (SaaS e colaboração em tempo real, camada de percepção e sensores, análise exploratória e regressão, classificação supervisionada de imagens) e um espaço para a dupla preencher.
- `README.md`: descrição do projeto, a dor local, como abrir o painel, como publicar no **GitHub Pages** (passo a passo curto: criar repositório, enviar os arquivos, ativar Pages na branch principal) e como organizar a pasta do Google Drive da dupla.

## 9. Ordem de execução sugerida

1. Fase 1 (painel) — mostrar o resultado e testar.
2. Gerar o CSV de exemplo.
3. Fase 3 (notebook), executando para validar.
4. Fase 2 (Wokwi).
5. Fase 4 (integração do Teachable Machine).
6. Fase 5 (README e roteiro).

Ao final de cada fase, rodar uma verificação rápida e resumir o que foi feito em 2 ou 3 linhas.
