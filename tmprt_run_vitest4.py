import subprocess, sys

r = subprocess.run(
    "npx vitest run src/pages/tutor/DashboardTutor.test.jsx --coverage",
    shell=True,
    cwd="C:/Proyecto/coar-alerta-frontend",
    capture_output=True,
    text=True,
    timeout=900,
    encoding="utf-8",
    errors="replace",
)
out = r.stdout + "\n" + r.stderr
with open("C:/Proyecto/tmp_vitest_out4.txt", "w", encoding="utf-8") as f:
    f.write(out)
sys.stdout.write("RC " + str(r.returncode) + "\n")
k = out.find("% Stmts")
sys.stdout.write("KDX " + str(k) + "\n")
if k >= 0:
    sys.stdout.write(out[k - 2000:k + 4000])
