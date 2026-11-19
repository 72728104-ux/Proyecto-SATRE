import sys

d = open('C:/Proyecto/tmp_vitest_out5.txt', encoding='utf-8', errors='replace').read()
sys.stdout.reconfigure(encoding='utf-8')
sys.stdout.write("LEN " + str(len(d)) + "\n")
sys.stdout.write(d[:1800])
