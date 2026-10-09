# Save as find-user-api.py
import os

for f in os.listdir('.'):
    if f.endswith('.js'):
        try:
            content = open(f, 'r', encoding='utf-8').read()
            count = content.count('/api/user/')
            if count > 0:
                print(f'{f}: {count} references to /api/user/')
        except:
            pass
# Save as find-user-api.py
import os

for f in os.listdir('.'):
    if f.endswith('.js'):
        try:
            content = open(f, 'r', encoding='utf-8').read()
            count = content.count('/api/user/')
            if count > 0:
                print(f'{f}: {count} references to /api/user/')
        except:
            pass
