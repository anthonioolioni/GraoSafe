// GraoSafe — ESP32 + DHT22 + 3 LEDs (verde, amarelo, vermelho)
// Lê temperatura e umidade a cada 2 s, calcula o risco, acende o LED e imprime no
// Serial Monitor em CSV:  timestamp_ms,silo,temperatura,umidade,risco
// Essas linhas podem ser coladas no painel web (seção "Sensor real").

#include <DHT.h>

#define PINO_DHT 15
#define LED_VERDE 25
#define LED_AMARELO 26
#define LED_VERMELHO 27

// Limites didáticos (iguais aos do painel web)
const float TEMP_ATENCAO = 28.0;  // °C
const float TEMP_PERIGO  = 32.0;
const float UMID_ATENCAO = 65.0;  // % UR
const float UMID_PERIGO  = 75.0;

const char* SILO = "A";
const unsigned long INTERVALO_MS = 2000;

DHT dht(PINO_DHT, DHT22);

// Mesma regra do painel: vermelho > amarelo > verde
const char* calcularRisco(float t, float u) {
  if (t > TEMP_PERIGO || u > UMID_PERIGO) return "vermelho";
  if (t >= TEMP_ATENCAO || u >= UMID_ATENCAO) return "amarelo";
  return "verde";
}

void acenderLed(const char* risco) {
  digitalWrite(LED_VERDE,    strcmp(risco, "verde") == 0);
  digitalWrite(LED_AMARELO,  strcmp(risco, "amarelo") == 0);
  digitalWrite(LED_VERMELHO, strcmp(risco, "vermelho") == 0);
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_VERDE, OUTPUT);
  pinMode(LED_AMARELO, OUTPUT);
  pinMode(LED_VERMELHO, OUTPUT);
  dht.begin();
  Serial.println("timestamp_ms,silo,temperatura,umidade,risco");  // cabeçalho do CSV
}

void loop() {
  float t = dht.readTemperature();
  float u = dht.readHumidity();

  if (isnan(t) || isnan(u)) {
    Serial.println("ERRO: leitura invalida do DHT22. Verifique a ligacao.");
  } else {
    const char* risco = calcularRisco(t, u);
    acenderLed(risco);
    Serial.print(millis()); Serial.print(',');
    Serial.print(SILO);     Serial.print(',');
    Serial.print(t, 1);     Serial.print(',');
    Serial.print(u, 1);     Serial.print(',');
    Serial.println(risco);
  }
  delay(INTERVALO_MS);
}
