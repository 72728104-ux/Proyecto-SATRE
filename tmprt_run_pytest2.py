import subprocess

cmd = '"C:/Proyecto/satre-analytics/venv/Scripts/python.exe" -m pytest tests/test_api.py --cov=app --cov-report=term-missing -q'
r = subprocess.run(
    cmd, shell=True, cwd="C:/Proyecto/satre-analytics", capture_output=True, text=True, timeout=1200, encoding="utf-8", errors="replace"
)
out = r.stdout + "\n" + r.stderr
with open("C:/Proyecto/tmp_pytest_out2.txt", "w", encoding="utf-8") as f:
    f.write(out)
sys_out = "RC " + str(r.returncode) + "\n"
with open("C:/Proyecto/tmp_pytest_rc.txt", "w", encoding="utf-8") as f:
    f.write(sys_out)
print(sys_out)
i = out.find("app\\api")
print(out[max(0, i - 1500): i + 2500] if i >= 0 else out[-3000:])
