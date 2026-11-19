import subprocess

cmd = "npx vitest run --coverage --coverage.include='src/**/*.{js,jsx}' --testTimeout=20000"
r = subprocess.run(
    cmd, shell=True, cwd="C:/Proyecto/coar-alerta-frontend", capture_output=True, text=True, timeout=3000, encoding="utf-8", errors="replace"
)
out = r.stdout + "\n" + r.stderr
with open("C:/Proyecto/tmp_vitest_out2.txt", "w", encoding="utf-8") as f:
    f.write(out)
print("RC", r.returncode)
