import subprocess

cmd = "npm run test -- --coverage"
r = subprocess.run(cmd, shell=True, cwd="C:/Proyecto/coar-alerta-frontend", capture_output=True, text=True, timeout=1800)
out = r.stdout + "\n" + r.stderr
with open("C:/Proyecto/tmp_vitest_out.txt", "w", encoding="utf-8") as f:
    f.write(out)
print("RC", r.returncode)
