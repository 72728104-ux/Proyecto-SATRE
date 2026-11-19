import re

d = open('C:/Proyecto/tmp_vitest_out2.txt', encoding='utf-8', errors='replace').read()
i = d.find('Coverage report')
print(d[i:i+6000] if i >= 0 else d[-6000:])
