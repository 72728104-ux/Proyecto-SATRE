import subprocess, sys

r = subprocess.run(
    "npx vitest run src/pages/RecuperarContrasena.test.jsx src/pages/CambiarContrasena.test.jsx src/pages/RestablecerContrasena.test.jsx",
    shell=True,
    cwd="C:/Proyecto/coar-alerta-frontend",
    capture_output=True,
    text=True,
    timeout=1200,
    encoding="utf-8",
    errors="replace",
)
out = r.stdout + "\n" + r.stderr
with open("C:/Proyecto/tmp_vitest_out6.txt", "w", encoding="utf-8") as f:
    f.write(out)
sys.stdout.write("RC " + str(r.returncode) + "\n")
k = out.find("% Stmts")
sys.stdout.write("KDX " + str(k) + "\n")
if k >= 0:
    sys.stdout.write(out[k - 200: k + 2500])
