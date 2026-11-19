import subprocess

cmd = '"C:/Proyecto/satre-analytics/venv/Scripts/python.exe" -m pytest --cov=app --cov-report=term-missing -q'
r = subprocess.run(
    cmd, shell=True, cwd="C:/Proyecto/satre-analytics", capture_output=True, text=True, timeout=1200, encoding="utf-8", errors="replace"
)
out = r.stdout + "\n" + r.stderr
with open("C:/Proyecto/tmp_pytest_out3.txt", "w", encoding="utf-8") as f:
    f.write(out)
with open("C:/Proyecto/tmp_pytest_rc3.txt", "w", encoding="utf-8") as f:
    f.write("RC " + str(r.returncode) + "\n")
print("RC", r.returncode)
i = out.find("Name")
print(out[i:i + 4200] if i >= 0 else out[-4000:])
