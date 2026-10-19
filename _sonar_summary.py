import json
from collections import defaultdict, Counter

p = r"c:\Proyecto\reporte_incidencias.json"
with open(p, encoding="utf-8") as f:
    data = json.load(f)
print("ROOT_TYPE", type(data).__name__)
if isinstance(data, dict):
    print("ROOT_KEYS", list(data.keys())[:40])
    issues = data.get("issues") or data.get("incidencias") or data.get("results")
    if issues is None:
        # maybe dict of issues
        print("FIRST_VALUE_TYPE", type(next(iter(data.values()))).__name__)
        issues = list(data.values())
elif isinstance(data, list):
    issues = data
else:
    raise SystemExit("unknown")
print("ISSUES_TYPE", type(issues).__name__, "LEN", len(issues) if hasattr(issues, "__len__") else None)
if issues:
    print("FIRST_ITEM_TYPE", type(issues[0]).__name__)
    if isinstance(issues[0], dict):
        print("FIRST_KEYS", list(issues[0].keys())[:20])
    else:
        print("FIRST_ITEM", repr(issues[0])[:300])

print("=== BY TYPE ===")
print(Counter(i["type"] for i in issues))
print("=== BY SEVERITY ===")
print(Counter(i["severity"] for i in issues))

print("\n=== VULNERABILITIES ===")
vulns = [i for i in issues if i["type"] == "VULNERABILITY"]
print("count", len(vulns))
for i in vulns:
    path = i["component"].split(":", 1)[-1]
    print(f"{i['severity']:8} {i['rule']:30} L{i.get('line','?'):>4} {path}")
    print(f"         {i['message'][:180]}")

print("\n=== BUGS ===")
bugs = [i for i in issues if i["type"] == "BUG"]
print("count", len(bugs))
for i in bugs:
    path = i["component"].split(":", 1)[-1]
    print(f"{i['severity']:8} {i['rule']:30} L{i.get('line','?'):>4} {path}")
    print(f"         {i['message'][:180]}")

print("\n=== TOP FILES ===")
by_file = defaultdict(lambda: Counter())
for i in issues:
    fpath = i["component"].split(":", 1)[-1]
    by_file[fpath][i["type"]] += 1


def score(c):
    return (
        c.get("VULNERABILITY", 0) * 100
        + c.get("BUG", 0) * 10
        + c.get("CODE_SMELL", 0),
        c.get("VULNERABILITY", 0),
        c.get("BUG", 0),
        sum(c.values()),
    )


ranked = sorted(by_file.items(), key=lambda kv: score(kv[1]), reverse=True)
print("TOP 15 FILES:")
for fpath, c in ranked[:15]:
    v = c.get("VULNERABILITY", 0)
    b = c.get("BUG", 0)
    s = c.get("CODE_SMELL", 0)
    t = sum(c.values())
    print(f"  V={v} B={b} S={s} T={t:3}  {fpath}")

print("\n=== CODE SMELL RULES ===")
smells = [i for i in issues if i["type"] == "CODE_SMELL"]
print("count", len(smells))
print(Counter(i["rule"] for i in smells).most_common(25))
print("\n=== VULN RULES ===")
print(Counter(i["rule"] for i in vulns))
print("\n=== FILES WITH VULNS ===")
for fpath, c in ranked:
    if c.get("VULNERABILITY"):
        print(fpath, dict(c))
