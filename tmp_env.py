import subprocess

cmds = [
    ["php", "-v"],
    ["php", "artisan", "--version"],
    ["pytest", "--version"],
    ["python", "-m", "pytest", "--version"],
]
for cmd in cmds:
    r = subprocess.run(
        cmd, shell=True, cwd="C:/Proyecto/satre-analytics", capture_output=True, text=True, timeout=120, encoding="utf-8", errors="replace"
    )
    print("CMD:", cmd, "RC", r.returncode)
    print((r.stdout or "")[:400])
    print((r.stderr or "")[:400])
