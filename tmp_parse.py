import json

raw = open('C:/Proyecto/Cobertura.json', 'rb').read().decode('utf-8').strip()
d = json.loads('{' + raw)
print('TOP KEYS:', list(d.keys()))
for k, v in d.items():
    if k in ('issues', 'components', 'facets'):
        continue
    print(k, '=', v)

print('\nCOMPONENTS:')
for c in d.get('components') or []:
    print(json.dumps(c, ensure_ascii=False)[:1500])
    print('---')

print('\nFACETS:')
for f in d.get('facets') or []:
    print(json.dumps(f, ensure_ascii=False)[:2000])
    print('---')

print('\nISSUES SUMMARY:')
from collections import Counter
print('types:', Counter(i.get('type') for i in d.get('issues') or []))
print('statuses:', Counter(i.get('status') for i in d.get('issues') or []))
print('resolutions:', Counter(str(i.get('resolution')) for i in d.get('issues') or []))
print('severities:', Counter(i.get('severity') for i in d.get('issues') or []))
print('rules:', Counter(i.get('rule') for i in d.get('issues') or []))
comps = Counter(i.get('component') for i in d.get('issues') or [])
print('COMPONENTS WITH ISSUES:')
for c, n in comps.items():
    print('  ', n, c)
