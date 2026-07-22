import sqlite3
conn = sqlite3.connect('database.sqlite')
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cur.fetchall()
print("Tables:", tables)
for t in tables:
    name = t[0]
    cur.execute(f"SELECT * FROM {name} LIMIT 3")
    print(f"\n{name}:", cur.fetchall())
conn.close()
