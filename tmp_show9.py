import sys

d = open('C:/Proyecto/tmp_vitest_out5.txt', encoding='utf-8', errors='replace').read()
sys.stdout.reconfigure(encoding='utf-8')
k = d.find("Coverage report")
j = d.find("Coverage summary")
sys.stdout.write(d[k:j + 1200])
