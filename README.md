# 🌾 GraoSafe

Monitoramento de armazenagem de grãos para **Rondonópolis (MT)**: sensor (IoT), painel web, análise de dados e IA para checar a qualidade do grão.

Projeto acadêmico — Computação Contemporânea e Inteligência Artificial (Módulo 5).

## A dor local

Rondonópolis é um polo do agronegócio (soja e milho) e tem calor intenso. Pequenos e médios produtores e armazéns perdem grãos por **mofo e fungos** quando temperatura e umidade sobem dentro do depósito. Muitas vezes o problema só é percebido quando o grão já estragou.

**Solução:** o GraoSafe mede temperatura e umidade, mostra o risco em verde/amarelo/vermelho, avisa quando muda de nível e usa uma IA de imagens para checar se o grão está mofado.

> Os limites de risco são **simplificados, para fins didáticos**, e não uma norma técnica.

| Risco | Condição |
|---|---|
| 🟢 Seguro | temperatura < 28 °C **e** umidade < 65 % |
| 🟡 Atenção | temperatura de 28 a 32 °C **ou** umidade de 65 a 75 % |
| 🔴 Perigo | temperatura > 32 °C **ou** umidade > 75 % |

## O que tem na pasta

```
index.html                       painel web (tudo em um arquivo)
wokwi/                           circuito e código do ESP32 + DHT22
colab/analise_graosafe.ipynb     análise exploratória + regressão
dados/exemplo_graosafe.csv       CSV de exemplo (1500 leituras)
dados/gerar_csv.py               script que gerou o CSV
relatorio/roteiro_relatorio.md   roteiro do relatório
```

## Como abrir o painel

Dê duplo clique em **index.html**. Não precisa instalar nada nem ter servidor (só internet, para carregar o gráfico).

- Leituras simuladas de 3 silos, uma nova a cada 5 s (dá para mudar para 2 s ou 10 s).
- Cada leitura avança 10 minutos no relógio simulado: um dia inteiro passa em poucos minutos.
- **Simular falha de ventilação** faz o silo escolhido esquentar e ficar úmido até o vermelho e gera um alerta.
- **Baixar CSV** salva as leituras no formato `timestamp,silo,temperatura,umidade,risco`.

## Como publicar no GitHub Pages

1. Crie uma conta em github.com e clique em **New repository** (ex.: `graosafe`, público).
2. Clique em **uploading an existing file** e envie todos os arquivos desta pasta (o `index.html` precisa ficar na raiz). Clique em **Commit changes**.
3. Vá em **Settings → Pages**. Em *Build and deployment*, escolha **Deploy from a branch**, branch **main**, pasta **/ (root)** e salve.
4. Espere 1 a 2 minutos. O link aparece na mesma tela: `https://SEU-USUARIO.github.io/graosafe/`.

## IoT no Wokwi (ESP32 + DHT22)

1. Entre em wokwi.com → **New Project** → **ESP32**.
2. Cole o conteúdo de `wokwi/sketch.ino` na aba `sketch.ino`.
3. Cole `wokwi/diagram.json` na aba `diagram.json` (substitui o circuito).
4. Na aba `libraries.txt` (ou no botão **Library Manager**), adicione o conteúdo de `wokwi/libraries.txt`.
5. Clique em **▶ Start the simulation**. Abra o Serial Monitor para ver as linhas em CSV.
6. Clique no **DHT22** e mexa nos controles de temperatura e umidade: os LEDs mudam de cor conforme o risco.

### Levando os dados do Wokwi para o painel

1. Com a simulação rodando, selecione as linhas do **Serial Monitor** (ex.: `16682,A,16.4,51.0,verde`) e copie.
2. No painel (`index.html`), vá na seção **📡 Sensor real**, cole no campo de texto e clique em **Importar leituras**.
3. O **Silo A** passa a mostrar **📡 Sensor ESP32 (Wokwi)**; o gráfico, os alertas e o CSV usam esses valores. Cole mais linhas quando quiser atualizar.
4. Clique em **Voltar à simulação** para o Silo A voltar a ser simulado.

Ligações: DHT22 no GPIO 15 (3V3 e GND); LEDs verde/amarelo/vermelho nos GPIO 25/26/27, cada um com resistor de 220 Ω.

## Análise no Google Colab

1. Abra colab.research.google.com → **Arquivo → Fazer upload de notebook** → `colab/analise_graosafe.ipynb`.
2. Na célula de carregamento, mude `USAR_UPLOAD = True` (envia o CSV) ou preencha `LINK_DRIVE`.
3. Execute tudo (**Ambiente de execução → Executar tudo**).

## IA com Teachable Machine

1. Acesse teachablemachine.withgoogle.com → **Projeto de imagens** → **Modelo de imagem padrão**.
2. Crie 2 classes: **Grão saudável** e **Grão mofado/ardido** (cerca de 30 fotos cada, por webcam ou arquivos).
3. Clique em **Treinar modelo** e depois em **Exportar modelo → Upload (nuvem) → Fazer upload do meu modelo**.
4. Copie o link (`https://teachablemachine.withgoogle.com/models/XXXX/`).
5. No painel, na seção **Checagem do grão (IA)**, cole o link, clique em **Carregar modelo** e use a webcam ou envie uma foto.

Se a probabilidade da classe "mofado/ardido" passar de 70 %, o painel mostra um alerta. O nome da classe precisa conter "mofado" ou "ardido" para a detecção funcionar.

## Organização da pasta no Google Drive

Crie uma pasta compartilhada com a dupla (e o professor), por exemplo:

```
GraoSafe - Nome1 e Nome2/
├── 1_Nuvem/      prints do Drive e do compartilhamento
├── 2_IoT/        sketch.ino, diagram.json, libraries.txt, prints do Wokwi
├── 3_Dados/      exemplo_graosafe.csv e analise_graosafe.ipynb
├── 4_IA/         prints e link do modelo do Teachable Machine
└── Relatorio/    relatório final (PDF) e link do painel no GitHub Pages
```

## Limitações

Os dados do painel são **simulados** e os limites de risco são **didáticos**. Para uso real seriam necessários sensores calibrados e critérios técnicos de armazenagem.
