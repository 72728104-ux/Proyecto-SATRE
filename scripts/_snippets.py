import json
import sys
import collections
from pathlib import Path

d = json.load(open('reporte_nuevas_incidencias.json', encoding='utf-8'))
prefix = sys.argv[1]
ctx = int(sys.argv[2]) if len(sys.argv) > 2 else 3

g = collections.defaultdict(list)
for i in d['issues']:
    comp = i['component'].split(':', 1)[1]
    if comp.startswith(prefix):
        g[comp].append(i)

root = Path('.')
for f in sorted(g):
    p = root / f
    if not p.exists():
        print(f'### {f} (MISSING)')
        continue
    lines = p.read_text(encoding='utf-8', errors='replace').splitlines()
    print(f'### {f}')
    seen = set()
    for i in sorted(g[f], key=lambda x: (x.get('line') or 0)):
        ln = i.get('line')
        print(f"  >> L{ln} [{i['rule']}] {i['message']}")
        if not ln:
            continue
        a = max(1, ln - ctx)
        b = min(len(lines), ln + ctx)
        for n in range(a, b + 1):
            print(f'   {n:5d}| {lines[n-1]}')
        print()
