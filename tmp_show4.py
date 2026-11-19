import sys

d = open('C:/Proyecto/tmp_vitest_out3.txt', encoding='utf-8', errors='replace').read()
sys.stdout.reconfigure(encoding='utf-8')
sys.stdout.write("\n==== TAIL ====\n")
sys.stdout.write(d[-6000:])
