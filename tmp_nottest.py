import os, re

src_dir = 'C:/Proyecto/coar-alerta-frontend/src'
tests = set()
for dirpath, dirnames, filenames in os.walk(src_dir):
    for fn in filenames:
        if fn.endswith('.test.js') or fn.endswith('.test.jsx'):
            tests.add(os.path.join(dirpath, fn))

src_files = []
for dirpath, dirnames, filenames in os.walk(src_dir):
    dirnames[:] = [d for d in dirnames if d not in ('__tests__',)]
    for fn in sorted(filenames):
        if fn.endswith(('.js', '.jsx')) and not fn.endswith('.test.js') and not fn.endswith('.test.jsx'):
            if fn.endswith('.d.ts'):
                continue
            src_files.append(os.path.join(dirpath, fn))

print('SOURCE FILES WITHOUT TEST:', len([f for f in src_files if f not in tests]))
for f in sorted(src_files):
    if f not in tests:
        print('NO TEST ->', f.replace(src_dir + '/', ''))
print()
print('TEST FILES:', len(tests))
for t in sorted(tests):
    print('TEST ->', t.replace(src_dir + '/', ''))
