import os, re

paths = [
    'docs/sonar/GUIA_SONARQUBE_SATRE.md',
    'SATRE_TOBE.md', 'SATRE TOBE-2.md', 'SATRE TOBE-3.md', 'SATRE TOBE-4.md', 'SATRE TOBE-5.md',
    'coar-alerta-frontend/README.md', 'satre-backend/README.md', 'satre-analytics/README.md',
    'deploy/sonar/README.md', 'incidencias_por_archivo.txt',
]
for p in paths:
    fp = 'C:/Proyecto/' + p
    text = open(fp, encoding='utf-8', errors='replace').read()
    lines = text.split('\n')
    hits = []
    for i, ln in enumerate(lines, 1):
        if re.search(r'74(\.\d+)?\s*%|cobertura actual|\b74\b', ln, re.I):
            hits.append((i, ln))
    if hits:
        print('=' * 30, p)
        for i, ln in hits:
            print(f'{i}: {ln.encode("ascii", "replace").decode("ascii")}')
        print()
