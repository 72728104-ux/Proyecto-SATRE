import subprocess, sys

r = subprocess.run(
    "npm run test -- --coverage",
    shell=True,
    cwd="C:/Proyecto/coar-alerta-frontend",
    capture_output=True,
    text=True,
    timeout=3000,
    encoding="utf-8",
    errors="replace",
)
out = r.stdout + "\n" + r.stderr
with open("C:/Proyecto/tmp_vitest_out3.txt", "w", encoding="utf-8") as f:
    f.write(out)
sys.stdout.write("RC " + str(r.returncode) + "\n")
sys.stdout.write("LEN " + str(len(out)) + "\n")
i = out.find("Coverage report")
sys.stdout.write("IDX " + str(i) + "\n")
j = out.find("Coverage summary")
sys.stdout.write("JDX " + str(j) + "\n")
k = out.find("% Stmts")
sys.stdout.write("KDX " + str(k) + "\n")
if k >= 0:
    sys.stdout.write(out[k - 3000:k + 8000])
