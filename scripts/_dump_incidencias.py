import json
import collections

d = json.load(open('reporte_nuevas_incidencias.json', encoding='utf-8'))
g = collections.defaultdict(list)
for i in d['issues']:
    g[i['component'].split(':', 1)[1]].append(i)

lines = []
for f in sorted(g):
    lines.append('### ' + f)
    for i in sorted(g[f], key=lambda x: (x.get('line') or 0)):
        lines.append(f"  L{i.get('line')} [{i['rule']}] {i['severity']}: {i['message']}")

open('incidencias_por_archivo.txt', 'w', encoding='utf-8').write('\n'.join(lines))
print('lines', len(lines), 'files', len(g))
