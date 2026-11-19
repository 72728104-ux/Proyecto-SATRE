import os, glob

root = 'C:/Proyecto'
skip_dirs = {'.git', '.scannerwork', 'node_modules', '.cursor', '__pycache__', '.venv', 'venv'}
for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [d for d in dirnames if d not in skip_dirs]
    for fn in sorted(filenames):
        if fn.endswith(('.py', '.js', '.jsx', '.ts', '.tsx', '.json', '.txt', '.md', '.properties', '.yml', '.yaml', '.cfg', '.ini')):
            p = os.path.join(dirpath, fn)
            rel = os.path.relpath(p, root)
            if any(s in rel for s in ['node_modules', '.git', '__pycache__', '.venv', '.cursor', '.scannerwork', 'dist', 'build']):
                continue
            try:
                sz = os.path.getsize(p)
            except Exception:
                continue
            print(f'{sz:>10}  {rel}')
