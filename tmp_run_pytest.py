import subprocess

cmd = '"C:/Proyecto/satre-analytics/venv/Scripts/python.exe" -m pytest --cov=app --cov-report=term-missing'
r = subprocess.run(
    cmd, shell=True, cwd="C:/Proyecto/satre-analytics", capture_output=True, text=True, timeout=2400, encoding="utf-8", errors="replace"
)
out = r.stdout + "\n" + r.stderr
with open("C:/Proyecto/tmp_pytest_out.txt", "w", encoding="utf-8") as f:
    f.write(out)
print("RC", r.returncode)
