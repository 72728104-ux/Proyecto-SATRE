import xml.etree.ElementTree as ET

tree = ET.parse('C:/Proyecto/satre-backend/coverage.xml')
root = tree.getroot()
rows = []

for pkg in root.iter('package'):
    for f in pkg.iter('file'):
        name = f.get('name')
        lines = [l for l in f.findall('line') if l.get('type') in ('method', 'class')]
        total = len(lines)
        covered = sum(1 for l in lines if int(l.get('count') or 0) > 0)
        pct = (covered / total * 100) if total else 0.0
        cl = f.find('class')
        m = dict(cl.find('metrics').attrib) if cl is not None and cl.find('metrics') is not None else {}
        rows.append((pct, total, covered, name, m))

rows.sort(key=lambda r: r[0])
low = [r for r in rows if r[0] < 99.0]
print('TOTAL FILES', len(rows))
print('FILES BELOW 99%:', len(low))
print()
for pct, tot, cov, name, m in low:
    print(f'{pct:7.2f}%  cov={cov}/{tot}  {name}  {m}')

avg_cov_lines = sum(r[1] for r in rows) and None
tot_l = sum(r[1] for r in rows)
cov_l = sum(r[2] for r in rows)
print('AVG line coverage over files w/ lines: %.2f%% (%d/%d)' % (cov_l / tot_l * 100, cov_l, tot_l))
tot_s = []
for r in rows:
    tot_s.append((r[4].get('statements'), r[4].get('coveredstatements')))
ts = sum(float(a) for a, b in tot_s if a)
tcc = sum(float(b) for a, b in tot_s if a)
print('AVG statement coverage: %.2f%% (%s/%s)' % (tcc / ts * 100, tcc, ts))
