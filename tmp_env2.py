import subprocess

for py in [
    "C:/Proyecto/satre-analytics/.venv/Scripts/python.exe",
    "C:/Proyecto/satre-analytics/venv/Scripts/python.exe",
    "C:/Users/Usuario/AppData/Local/Programs/Python/Python313/python.exe",
]:
    r = subprocess.run(
        f'"{py}" -c "import pytest, pytest_cov, sys; print(sys.version); print(pytest.__version__); print(pytest_cov.__version__)"',
        shell=True, cwd="C:/Proyecto/satre-analytics", capture_output=True, text=True, timeout=120, encoding="utf-8", errors="replace",
    )
    print("PY:", py)
    print(r.stdout)
    print(r.stderr)
    print("-" * 40)
