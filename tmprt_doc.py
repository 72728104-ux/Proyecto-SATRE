import sys

d = open('C:/Proyecto/docs/sonar/GUIA_SONARQUBE_SATRE.md', encoding='utf-8', errors='replace').read()
lines = d.split('\n')
out = []
for a, b in [(960, 1010), (1120, 1160), (540, 560), (615, 665)]:
    out.append(f"########## {a}-{b}")
    for i in range(a - 1, min(b, len(lines))):
        out.append(f"{i+1}: {lines[i]}")
with open('C:/Proyecto/tmp_doc_out.txt', 'w', encoding='utf-8') as f:
    f.write("\n".join(out))
sys.stdout.write("OK")
