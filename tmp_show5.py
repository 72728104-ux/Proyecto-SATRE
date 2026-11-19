import sys

d = open('C:/Proyecto/tmp_vitest_out4.txt', encoding='utf-8', errors='replace').read()
sys.stdout.reconfigure(encoding='utf-8')
i = d.find("% Stmts")
sys.stdout.write(d[max(0, i - 1500):i + 3500])
