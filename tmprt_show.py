import sys

d = open('C:/Proyecto/tmp_vitest_out6.txt', encoding='utf-8', errors='replace').read()
sys.stdout.reconfigure(encoding='utf-8')
print("LEN", len(d))
print(d[:4500])
