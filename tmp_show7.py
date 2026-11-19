import sys

d = open('C:/Proyecto/tmp_doc_out.txt', encoding='utf-8', errors='replace').read()
sys.stdout.reconfigure(encoding='utf-8')
print(d)
