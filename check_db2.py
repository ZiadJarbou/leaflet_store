import sqlite3
conn = sqlite3.connect('server/leafletai.db')
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [t[0] for t in cur.fetchall()]
print("Tables:", tables)
for t in tables:
    cur.execute(f"SELECT * FROM {t} LIMIT 2")
    rows = cur.fetchall()
    # Get column names
    cur.execute(f"PRAGMA table_info({t})")
    cols = [c[1] for c in cur.fetchall()]
    print(f"\n=== {t} ===")
    print("Columns:", cols)
    for r in rows:
        print(r)
conn.close()
