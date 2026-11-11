"""Gera dados/exemplo_graosafe.csv com a MESMA lógica da simulação do painel (index.html).

Uso:  py dados/gerar_csv.py
Saída: dados/exemplo_graosafe.csv  (500 leituras x 3 silos = 1500 linhas)
"""
import csv
import math
import os
import random
from datetime import datetime, timedelta

random.seed(42)  # resultado sempre igual

# --- mesmos parâmetros do CONFIG do index.html ---
TEMP_ATENCAO, TEMP_PERIGO = 28, 32
UMID_ATENCAO, UMID_PERIGO = 65, 75
TEMP_MEDIA, TEMP_AMPLITUDE, HORA_PICO = 27, 4, 15
UMID_BASE, UMID_POR_GRAU = 55, 2
RUIDO_TEMP, RUIDO_UMID = 0.4, 1.5
FALHA_TEMP, FALHA_UMID = 7, 18
FALHA_SOBE, FALHA_DESCE = 0.12, 0.25
MINUTOS_POR_LEITURA = 10
N_LEITURAS = 500  # por silo

SILOS = {"A": (0.0, 0.0), "B": (-0.5, 2.0), "C": (0.8, 3.0)}  # (deslocamento temp, umid)

# episódios de falha de ventilação: silo -> lista de (leitura_inicial, leitura_final)
FALHAS = {"A": [(150, 185)], "B": [(300, 340)], "C": [(60, 95), (380, 420)]}


def calcular_risco(t, u):
    if t > TEMP_PERIGO or u > UMID_PERIGO:
        return "vermelho"
    if t >= TEMP_ATENCAO or u >= UMID_ATENCAO:
        return "amarelo"
    return "verde"


inicio = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
inicio = datetime(inicio.year, inicio.month, inicio.day)
nivel = {s: 0.0 for s in SILOS}
linhas = []

for i in range(N_LEITURAS):
    minuto = 6 * 60 + i * MINUTOS_POR_LEITURA  # começa às 06:00
    hora = (minuto / 60) % 24
    ts = inicio + timedelta(minutes=minuto)
    for silo, (d_temp, d_umid) in SILOS.items():
        ativa = any(a <= i <= b for a, b in FALHAS[silo])
        nivel[silo] = min(1, nivel[silo] + FALHA_SOBE) if ativa else max(0, nivel[silo] - FALHA_DESCE)
        n = nivel[silo]
        ciclo = math.sin(2 * math.pi * (hora - HORA_PICO + 6) / 24)
        temp_sem_falha = TEMP_MEDIA + TEMP_AMPLITUDE * ciclo + d_temp + random.uniform(-RUIDO_TEMP, RUIDO_TEMP)
        temp = temp_sem_falha + FALHA_TEMP * n
        umid = UMID_BASE - UMID_POR_GRAU * (temp_sem_falha - TEMP_MEDIA) + d_umid \
            + random.uniform(-RUIDO_UMID, RUIDO_UMID) + FALHA_UMID * n
        temp = round(temp, 1)
        umid = round(min(100, max(0, umid)), 1)
        linhas.append([ts.strftime("%Y-%m-%d %H:%M:%S"), silo, f"{temp:.1f}", f"{umid:.1f}", calcular_risco(temp, umid)])

destino = os.path.join(os.path.dirname(os.path.abspath(__file__)), "exemplo_graosafe.csv")
with open(destino, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["timestamp", "silo", "temperatura", "umidade", "risco"])
    w.writerows(linhas)
print(f"{len(linhas)} linhas gravadas em {destino}")
