import sys

p = 'C:/Proyecto/satre-analytics/app/services/ai/teacher_hybrid.py'
d = open(p, encoding='utf-8', errors='replace').read()
i = d.find('def get_teacher_dashboard_data')
sys.stdout.write(d[i:i + 2500])
