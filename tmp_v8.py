import subprocess, json, glob, os

# find vitest coverage defaults
p = 'C:/Proyecto/coar-alerta-frontend/node_modules/@vitest/coverage-v8/dist/index.js'
print(os.path.exists(p))
print(open(p, encoding='utf-8', errors='replace').read()[:3000])
