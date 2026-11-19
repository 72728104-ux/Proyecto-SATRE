import json, glob, os, re

files = [
    'C:/Proyecto/reporte_incidencias.json',
    'C:/Proyecto/reporte_nuevas_incidencias.json',
    'C:/Proyecto/reporte_*.json',
    'C:/Proyecto/Cobertura.json',
    'C:/Proyecto/MejorasSonarqube.json',
    'C:/Proyecto/MejorasFinalesSonarQube.json',
]
for f in files:
    p = f.replace('C:/Proyecto/reporte_*', 'C:/Proyecto/reporte_incidencias.json')
    for cand in sorted(glob.glob('C:/Proyecto/' + f.split('/')[-1])):
        raw = open(cand, 'rb').read().decode('utf-8', 'replace')
        print('=' * 30, cand, len(raw))
        low = raw.lower()
        for kw in ['coverage', 'line', 'branch', '74', '90', 'total']:
            pass
        # print first 600 chars
        print(raw[:600].replace('\n', ' '))
        print()
