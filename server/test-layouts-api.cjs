/**
 * server/test-layouts-api.cjs
 * Run: node server/test-layouts-api.cjs
 *
 * Full integration test for all /api/layouts endpoints.
 * Uses Node's built-in fetch (Node 18+).
 */

'use strict';

const BASE = 'http://localhost:4000';

let PASS = 0, FAIL = 0;
const results = [];

/* ── helpers ── */
function ok(label, cond, detail = '') {
  if (cond) { PASS++; results.push(`  ✓  ${label}`); }
  else       { FAIL++; results.push(`  ✗  ${label}${detail ? ' — ' + detail : ''}`); }
}

async function req(method, path, body, token) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  let json;
  try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, body: json };
}

/* ══════════════════════════════════════════════════ */

async function run() {
  console.log('\n=== LeafletAI Layout API — Integration Tests ===\n');

  /* ── 0. Auth — get token ── */
  console.log('[ Auth ]');
  let token;

  const signupRes = await req('POST', '/api/signup', {
    name: 'Layout Tester', email: `tester_${Date.now()}@test.com`, password: 'Test1234',
  });
  if (signupRes.status === 200 && signupRes.body.token) {
    token = signupRes.body.token;
    ok('signup returns token', true);
  } else {
    ok('signup returns 201 + token', false, JSON.stringify(signupRes.body));
    console.log('\nCannot continue without a token.\n'); process.exit(1);
  }

  /* ── 1. Layout CRUD ── */
  console.log('\n[ Layout CRUD ]');
  let layoutId, layoutVersion;

  // create
  const createRes = await req('POST', '/api/layouts', {
    name: 'Test Card', card_width: 360, card_height: 480,
    card_background: { type: 'solid', color: '#FAFAFA' },
  }, token);
  ok('POST /api/layouts → 201', createRes.status === 201);
  ok('layout has id', !!createRes.body.layout?.id);
  ok('layout has version=1', createRes.body.layout?.version === 1);
  layoutId      = createRes.body.layout?.id;
  layoutVersion = createRes.body.layout?.version;

  // list
  const listRes = await req('GET', '/api/layouts', null, token);
  ok('GET /api/layouts → 200', listRes.status === 200);
  ok('layouts array present', Array.isArray(listRes.body.layouts));
  ok('created layout in list', listRes.body.layouts?.some(l => l.id === layoutId));

  // get by id
  const getRes = await req('GET', `/api/layouts/${layoutId}`, null, token);
  ok('GET /api/layouts/:id → 200', getRes.status === 200);
  ok('layout.elements is array', Array.isArray(getRes.body.layout?.elements));

  // patch meta
  const patchRes = await req('PATCH', `/api/layouts/${layoutId}`, {
    name: 'Renamed Card', version: layoutVersion,
  }, token);
  ok('PATCH /api/layouts/:id → 200', patchRes.status === 200);
  ok('name updated', patchRes.body.layout?.name === 'Renamed Card');
  ok('version incremented', patchRes.body.layout?.version === 2);
  layoutVersion = patchRes.body.layout?.version;

  // optimistic lock conflict
  const conflictRes = await req('PATCH', `/api/layouts/${layoutId}`, {
    name: 'Should Conflict', version: 1, // stale
  }, token);
  ok('stale version → 409', conflictRes.status === 409);

  // unauthorised access
  const otherSignup = await req('POST', '/api/signup', {
    name: 'Other User', email: `other_${Date.now()}@test.com`, password: 'Test1234',
  });
  const otherToken = otherSignup.body.token;
  const aclRes = await req('GET', `/api/layouts/${layoutId}`, null, otherToken);
  ok('another user cannot read layout → 404', aclRes.status === 404);

  /* ── 2. Background ── */
  console.log('\n[ Background ]');

  const bgSolidRes = await req('PATCH', `/api/layouts/${layoutId}/background`, {
    type: 'solid', color: '#0B1220',
  }, token);
  ok('PATCH background solid → 200', bgSolidRes.status === 200);
  ok('background type is solid', bgSolidRes.body.layout?.card_background?.type === 'solid');
  layoutVersion = bgSolidRes.body.layout?.version;

  const bgGradRes = await req('PATCH', `/api/layouts/${layoutId}/background`, {
    type: 'linear', angle: 135,
    stops: [{ color: '#0B1220', pos: 0 }, { color: '#0E2A5A', pos: 1 }],
  }, token);
  ok('PATCH background gradient → 200', bgGradRes.status === 200);
  ok('background type is linear', bgGradRes.body.layout?.card_background?.type === 'linear');

  const bgBadRes = await req('PATCH', `/api/layouts/${layoutId}/background`, {
    type: 'solid', /* missing color */
  }, token);
  ok('background solid without color → 400', bgBadRes.status === 400);

  /* ── 3. Elements CRUD ── */
  console.log('\n[ Element CRUD ]');
  let elemId;

  const addElRes = await req('POST', `/api/layouts/${layoutId}/elements`, {
    field_key: 'product_name_lan1', type: 'text',
    x: 10, y: 230, w: 200, h: 30,
    styles: { fontSize: 16, fontWeight: 'bold', color: '#111827', align: 'left' },
  }, token);
  ok('POST element → 201', addElRes.status === 201);
  ok('element has id', !!addElRes.body.element?.id);
  ok('element field_key correct', addElRes.body.element?.field_key === 'product_name_lan1');
  elemId = addElRes.body.element?.id;

  // invalid field_key
  const badFieldRes = await req('POST', `/api/layouts/${layoutId}/elements`, {
    field_key: 'nonexistent', type: 'text',
  }, token);
  ok('invalid field_key → 400', badFieldRes.status === 400);

  // move + resize
  const patchElRes = await req('PATCH', `/api/layouts/${layoutId}/elements/${elemId}`, {
    x: 20, y: 240, w: 220, h: 32,
  }, token);
  ok('PATCH element move/resize → 200', patchElRes.status === 200);
  ok('x updated', patchElRes.body.element?.x === 20);
  ok('w updated', patchElRes.body.element?.w === 220);

  // style update
  const styleRes = await req('PATCH', `/api/layouts/${layoutId}/elements/${elemId}`, {
    styles: { fontSize: 18, textTransform: 'uppercase', script: 'none' },
  }, token);
  ok('PATCH element styles → 200', styleRes.status === 200);
  ok('fontSize updated', styleRes.body.element?.styles?.fontSize === 18);
  ok('textTransform updated', styleRes.body.element?.styles?.textTransform === 'uppercase');

  // invalid style value
  const badStyleRes = await req('PATCH', `/api/layouts/${layoutId}/elements/${elemId}`, {
    styles: { fontWeight: 'ultrabold' },
  }, token);
  ok('invalid fontWeight → 400', badStyleRes.status === 400);

  // lock element
  await req('PATCH', `/api/layouts/${layoutId}/elements/${elemId}`, { locked: true }, token);
  const lockedPatchRes = await req('PATCH', `/api/layouts/${layoutId}/elements/${elemId}`, { x: 99 }, token);
  ok('locked element PATCH → 423', lockedPatchRes.status === 423);
  // unlock
  await req('PATCH', `/api/layouts/${layoutId}/elements/${elemId}`, { locked: false }, token);

  /* ── 4. Add more elements for bulk/align tests ── */
  console.log('\n[ Bulk / Align / Order ]');

  const elIds = [elemId];
  for (const [fk, x, y] of [
    ['product_name_lan2', 10, 270],
    ['current_price',     10, 310],
    ['old_price',         10, 350],
  ]) {
    const r = await req('POST', `/api/layouts/${layoutId}/elements`, {
      field_key: fk, type: 'text', x, y, w: 160, h: 24,
    }, token);
    if (r.body.element?.id) elIds.push(r.body.element.id);
  }
  ok(`added ${elIds.length} elements total`, elIds.length === 4);

  // bulk move
  const bulkRes = await req('POST', `/api/layouts/${layoutId}/elements/bulk-update`, {
    element_ids: elIds,
    patch: { x: 15 },
  }, token);
  ok('bulk-update → 200', bulkRes.status === 200);
  ok('all elements returned', bulkRes.body.elements?.length === 4);
  ok('x applied to all', bulkRes.body.elements?.every(e => e.x === 15));

  // bulk style
  const bulkStyleRes = await req('POST', `/api/layouts/${layoutId}/elements/bulk-update`, {
    element_ids: elIds,
    patch: { styles: { color: '#FF0000' } },
  }, token);
  ok('bulk style update → 200', bulkStyleRes.status === 200);
  ok('color applied to all', bulkStyleRes.body.elements?.every(e => e.styles?.color === '#FF0000'));

  // align left
  const alignRes = await req('POST', `/api/layouts/${layoutId}/elements/align`, {
    element_ids: elIds, mode: 'left',
  }, token);
  ok('align left → 200', alignRes.status === 200);
  const xVals = alignRes.body.elements?.map(e => e.x);
  ok('all elements share same x after align-left', xVals && new Set(xVals).size === 1);

  // align center
  const alignCRes = await req('POST', `/api/layouts/${layoutId}/elements/align`, {
    element_ids: elIds, mode: 'center',
  }, token);
  ok('align center → 200', alignCRes.status === 200);

  // distribute vertical
  const distRes = await req('POST', `/api/layouts/${layoutId}/elements/align`, {
    element_ids: elIds, mode: 'distribute_vertical',
  }, token);
  ok('distribute_vertical → 200', distRes.status === 200);

  // invalid mode
  const badAlignRes = await req('POST', `/api/layouts/${layoutId}/elements/align`, {
    element_ids: elIds, mode: 'diagonal',
  }, token);
  ok('invalid align mode → 400', badAlignRes.status === 400);

  // z-order: send to front
  const orderRes = await req('POST', `/api/layouts/${layoutId}/elements/order`, {
    element_id: elemId, operation: 'front',
  }, token);
  ok('order front → 200', orderRes.status === 200);
  const frontEl = orderRes.body.elements?.find(e => e.id === elemId);
  const allZ    = orderRes.body.elements?.map(e => e.z_index);
  ok('element is at max z after front', allZ && frontEl && frontEl.z_index === Math.max(...allZ));

  // z-order: send to back
  const orderBackRes = await req('POST', `/api/layouts/${layoutId}/elements/order`, {
    element_id: elemId, operation: 'back',
  }, token);
  ok('order back → 200', orderBackRes.status === 200);
  const backEl = orderBackRes.body.elements?.find(e => e.id === elemId);
  const allZ2  = orderBackRes.body.elements?.map(e => e.z_index);
  ok('element is at min z after back', allZ2 && backEl && backEl.z_index === Math.min(...allZ2));

  /* ── 5. Render & Preview ── */
  console.log('\n[ Render & Preview ]');

  const renderRes = await req('GET', `/api/layouts/${layoutId}/render`, null, token);
  ok('GET render → 200', renderRes.status === 200);
  ok('render.canvas present', !!renderRes.body.render?.canvas);
  ok('render.elements array', Array.isArray(renderRes.body.render?.elements));
  ok('render elements have rect', renderRes.body.render?.elements?.every(e => e.rect));

  const previewRes = await req('POST', `/api/layouts/${layoutId}/preview`, {
    product_name_lan1: 'Apple', product_name_lan2: 'تفاح',
    current_price: 1.99, old_price: 2.49,
    product_image: 'https://example.com/apple.jpg',
    product_url:   'https://example.com/product/apple',
  }, token);
  ok('POST preview → 200', previewRes.status === 200);
  ok('preview.elements hydrated with value', previewRes.body.preview?.elements?.some(e => e.value !== null));

  // invalid URL in preview
  const badPreviewRes = await req('POST', `/api/layouts/${layoutId}/preview`, {
    product_url: 'not-a-url',
  }, token);
  ok('preview invalid URL → 400', badPreviewRes.status === 400);

  /* ── 6. History ── */
  console.log('\n[ History ]');
  const histRes = await req('GET', `/api/layouts/${layoutId}/history`, null, token);
  ok('GET history → 200', histRes.status === 200);
  ok('history array', Array.isArray(histRes.body.history));
  ok('history has entries', histRes.body.history?.length > 0);

  /* ── 7. Delete element ── */
  console.log('\n[ Delete ]');
  const delElRes = await req('DELETE', `/api/layouts/${layoutId}/elements/${elemId}`, null, token);
  ok('DELETE element → 200', delElRes.status === 200);
  const afterDel = await req('GET', `/api/layouts/${layoutId}`, null, token);
  ok('element gone after delete', !afterDel.body.layout?.elements?.some(e => e.id === elemId));

  // delete layout
  const delLayoutRes = await req('DELETE', `/api/layouts/${layoutId}`, null, token);
  ok('DELETE layout → 200', delLayoutRes.status === 200);
  const goneRes = await req('GET', `/api/layouts/${layoutId}`, null, token);
  ok('layout gone after delete → 404', goneRes.status === 404);

  /* ── Summary ── */
  console.log('\n' + results.join('\n'));
  const total = PASS + FAIL;
  console.log(`\n${'─'.repeat(44)}`);
  console.log(`  Results: ${PASS}/${total} passed${FAIL ? `  (${FAIL} FAILED)` : '  — ALL PASS'}`);
  console.log('─'.repeat(44) + '\n');
  if (FAIL) process.exit(1);
}

run().catch(err => { console.error('Unexpected error:', err); process.exit(1); });
