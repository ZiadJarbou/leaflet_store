const ts = Date.now();
fetch('http://localhost:4000/api/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Tester', email: 'tester_' + ts + '@test.com', password: 'Test1234' }),
}).then(r => r.json()).then(j => console.log(JSON.stringify(j, null, 2))).catch(console.error);
