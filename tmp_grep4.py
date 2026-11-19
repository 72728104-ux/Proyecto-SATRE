import re

fp = 'C:/Proyecto/docs/sonar/GUIA_SONARQUBE_SATRE.md'
text = open(fp, encoding='utf-8', errors='replace').read()
lines = text.split('\n')
for i, ln in enumerate(lines, 1):
    if re.search(r'99,55|99\.55|74|cobertura|coverage|incluid', ln, re.I):
        print(f'{i}: {ln.encode("ascii", "replace").decode("ascii")}')
