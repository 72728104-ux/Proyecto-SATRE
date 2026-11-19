import subprocess, os

r = subprocess.run(
    "php artisan test",
    shell=True,
    cwd="C:/Proyecto/satre-backend",
    capture_output=True,
    text=True,
    timeout=1800,
    encoding="utf-8",
    errors="replace",
)
out = r.stdout + "\n" + r.stderr
with open("C:/Proyecto/tmp_php_out.txt", "w", encoding="utf-8") as f:
    f.write(out)
print("RC", r.returncode)
