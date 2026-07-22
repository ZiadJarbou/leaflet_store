from playwright.sync_api import sync_playwright

AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ6aWFkLmphcmJvdUBnbWFpbC5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTc3NTUxNTQ3NSwiZXhwIjoxNzc2MTIwMjc1fQ.V4-uBLLf1pNwgrOwcRZ-gJ-u5PK8KzAS7EyeF31VyG0"
AUTH_USER = '{"id":1,"email":"ziad.jarbou@gmail.com","name":"Ziad","role":"user"}'

errors = []
msgs = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.on("console", lambda m: msgs.append(f"[{m.type}] {m.text}"))
    page.on("pageerror", lambda e: errors.append(str(e)))

    page.goto("http://localhost:3000", wait_until="domcontentloaded")
    page.evaluate(f"""
        localStorage.setItem('leafletai_token', '{AUTH_TOKEN}');
        localStorage.setItem('leafletai_user', '{AUTH_USER}');
    """)
    page.goto("http://localhost:3000/app/leaflet/62", wait_until="networkidle")
    page.wait_for_timeout(3000)

    print("=== PAGE ERRORS ===")
    for e in errors:
        print(e)

    print("\n=== CONSOLE (errors/warnings only) ===")
    for m in msgs:
        if "error" in m.lower() or "warn" in m.lower():
            print(m)

    # Check DOM
    root_html = page.evaluate("document.getElementById('root')?.innerHTML?.slice(0, 500)")
    print("\n=== #root innerHTML (first 500) ===")
    print(root_html)

    # Check sidebar
    navbtns = page.locator(".lv-sb-nav-btn")
    print("Nav buttons:", navbtns.count())
    for i in range(navbtns.count()):
        print("  ", repr(navbtns.nth(i).text_content()))
    sb = page.locator(".lv-sidebar")
    print("Sidebar visible:", sb.is_visible() if sb.count() > 0 else False)
    a4 = page.locator(".lv-a4-page")
    print("A4 pages:", a4.count())
    browser.close()
