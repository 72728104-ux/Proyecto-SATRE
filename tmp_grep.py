import os, re, glob

root = 'C:/Proyecto'
kws = ['74', 'cobertura', 'coverage', '90', 'lcov', 'vitest', 'pytest']
hits = {}
for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [d for d in dirnames if d not in {'.git', 'node_modules', '.scannerwork', '.venv', 'venv', '__pycache__', '.pytest_cache', 'dist', 'build', 'storage', 'bootstrap', 'coverage'}]
    for fn in sorted(filenames):
        if not fn.endswith(('.py', '.js', '.jsx', '.md', '.txt', '.yml', '.yaml', '.properties', '.json', '.ini')):
            continue
        p = os.path.join(dirpath, fn)
        rel = os.path.relpath(p, root)
        if any(s in rel for s in ['node_modules', '.git', '__pycache__', '.venv', '.cursor', '.scannerwork', 'dist', 'build', 'storage', 'bootstrap', 'coverage', 'vendor']):
            continue
        try:
            text = open(p, encoding='utf-8', errors='replace').read()
        except Exception:
            continue
        for m in re.finditer(r'.{80}(cobertura|coverage|74%|lcov|vitest|pytest).{80}', text, re.I):
            key = (rel, m.group(0)[:200])
            hits.setdefault(key, 0)
            hits[key] += 1

for (rel, ctx), n in sorted(hits.items()):
    print('=' * 20, rel)
    print(ctx.replace('\n', ' | ').encode('ascii', 'replace').decode('ascii'))
    print()
