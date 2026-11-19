import os, re

root = 'C:/Proyecto'
paths = [
    'docs/sonar/GUIA_SONARQUBE_SATRE.md',
    'SATRE_TOBE.md', 'SATRE TOBE-2.md', 'SATRE TOBE-3.md', 'SATRE TOBE-4.md', 'SATRE TOBE-5.md',
    'coar-alerta-frontend/README.md', 'satre-backend/README.md', 'satre-analytics/README.md',
    'deploy/sonar/README.md',
]
for p in paths:
    fp = 'C:/Proyecto/' + p
    text = open(fp, encoding='utf-8', errors='replace').read()
    lines = text.split('\n')
    print('=' * 30, p, len(lines), 'lines')
    for i, ln in enumerate(lines, 1):
        if re.search(r'coverage|cobertura|%|lcov|vitest|pytest|74|90|test', ln, re.I):
            print(f'{i}: {ln}'.encode('ascii', 'replace').decode('ascii'))
