/**
 * server/seed-default-layout.cjs
 * Run: node server/seed-default-layout.cjs
 * Mirrors the lv-card layout from LeafletView.tsx
 */
'use strict';
const Database = require('better-sqlite3');
const crypto   = require('crypto');
const path     = require('path');

const DB_PATH = path.join(__dirname, 'leafletai.db');
const db      = new Database(DB_PATH);
const uuid    = () => crypto.randomUUID();
const nowIso  = () => new Date().toISOString();

const user = db.prepare('SELECT id FROM users LIMIT 1').get();
if (!user) { console.error('No users in DB — sign up first.'); process.exit(1); }

const existing = db.prepare(
  "SELECT id FROM card_layouts WHERE user_id = ? AND name = 'Default Product Card'"
).get(user.id);
if (existing) {
  // wipe old elements so we can re-seed fresh
  db.prepare('DELETE FROM layout_elements WHERE layout_id = ?').run(existing.id);
  db.prepare('DELETE FROM card_layouts WHERE id = ?').run(existing.id);
  console.log('Replaced existing default layout.');
}

// Card dimensions — mirrors lv-card grid width (~300 px) + body height
const W = 300;
const IMG_H = Math.round(W * 0.72);   // 216 — same as padding-top:72%
const BODY_PAD_TOP = 14;
const BODY_PAD_X   = 16;
const BODY_W = W - BODY_PAD_X * 2;    // 268

let y = IMG_H + BODY_PAD_TOP;         // 230

const DEFAULT_ELEMENTS = [
  /* product_image ── full-width image area */
  {
    field_key: 'product_image', type: 'image',
    x: 0, y: 0, w: W, h: IMG_H,
    rotate: 0, z_index: 0, locked: 0, visible: 1,
    background_json: null,
    styles_json: JSON.stringify({ objectFit: 'cover', radius: 0, opacity: 1 }),
  },
  /* product_name_lan1 ── 14px bold */
  {
    field_key: 'product_name_lan1', type: 'text',
    x: BODY_PAD_X, y, w: BODY_W, h: 22,
    rotate: 0, z_index: 1, locked: 0, visible: 1,
    background_json: null,
    styles_json: JSON.stringify({
      fontSize: 14, fontWeight: 'bold', fontStyle: 'normal',
      textTransform: 'none', color: '#e2e8f0',
      align: 'left', verticalAlign: 'top', lineHeight: 1.35,
    }),
  },
  /* product_name_lan2 ── 12px italic muted (y += 22+4) */
  {
    field_key: 'product_name_lan2', type: 'text',
    x: BODY_PAD_X, y: (y += 26), w: BODY_W, h: 18,
    rotate: 0, z_index: 2, locked: 0, visible: 1,
    background_json: null,
    styles_json: JSON.stringify({
      fontSize: 12, fontWeight: 'normal', fontStyle: 'italic',
      color: '#94a3b8', align: 'left', verticalAlign: 'top',
    }),
  },
  /* origin_lan1 ── 11.5px muted (y += 18+4) */
  {
    field_key: 'origin_lan1', type: 'text',
    x: BODY_PAD_X, y: (y += 22), w: Math.floor(BODY_W / 2), h: 18,
    rotate: 0, z_index: 3, locked: 0, visible: 1,
    background_json: null,
    styles_json: JSON.stringify({
      fontSize: 11.5, fontWeight: 'normal', color: '#888888',
      align: 'left', verticalAlign: 'top',
    }),
  },
  /* origin_lan2 ── same row, right side */
  {
    field_key: 'origin_lan2', type: 'text',
    x: BODY_PAD_X + Math.floor(BODY_W / 2) + 4, y, w: Math.ceil(BODY_W / 2) - 4, h: 18,
    rotate: 0, z_index: 4, locked: 0, visible: 1,
    background_json: null,
    styles_json: JSON.stringify({
      fontSize: 11.5, fontWeight: 'normal', color: '#888888',
      align: 'right', verticalAlign: 'top',
    }),
  },
  /* prices row (y += 18+8) */
  /* old_price ── 12px strikethrough */
  {
    field_key: 'old_price', type: 'text',
    x: BODY_PAD_X, y: (y += 26), w: 90, h: 20,
    rotate: 0, z_index: 5, locked: 0, visible: 1,
    background_json: null,
    styles_json: JSON.stringify({
      fontSize: 12, fontWeight: 'normal',
      textDecoration: 'line-through', color: '#94a3b8',
      align: 'left', verticalAlign: 'middle',
    }),
  },
  /* current_price ── 17px heavy, same row */
  {
    field_key: 'current_price', type: 'text',
    x: BODY_PAD_X + 94, y: y - 4, w: BODY_W - 94, h: 28,
    rotate: 0, z_index: 6, locked: 0, visible: 1,
    background_json: null,
    styles_json: JSON.stringify({
      fontSize: 17, fontWeight: 'bold', color: '#49f2b6',
      align: 'left', verticalAlign: 'middle',
    }),
  },
  /* product_url ── 12px brand-coloured link at bottom */
  {
    field_key: 'product_url', type: 'text',
    x: BODY_PAD_X, y: (y += 42), w: BODY_W, h: 22,
    rotate: 0, z_index: 7, locked: 0, visible: 1,
    background_json: null,
    styles_json: JSON.stringify({
      fontSize: 12, fontWeight: 'bold', color: '#49f2b6',
      align: 'left', verticalAlign: 'middle',
      textDecoration: 'underline',
    }),
  },
];

const TOTAL_H = y + 22 + 16;  // bottom of product_url + 16px padding

const layoutId = uuid();
const now      = nowIso();

db.prepare(`
  INSERT INTO card_layouts
    (id, user_id, name, card_width, card_height, card_background_json, version, created_at, updated_at)
  VALUES (?,?,?,?,?,?,1,?,?)
`).run(
  layoutId, user.id,
  'Default Product Card',
  W, TOTAL_H,
  JSON.stringify({ type: 'solid', color: '#1e1e2e' }),
  now, now,
);

const insertEl = db.prepare(`
  INSERT INTO layout_elements
    (id, layout_id, field_key, type, x, y, w, h, rotate, z_index,
     locked, visible, background_json, styles_json, created_at, updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

db.transaction(() => {
  for (const el of DEFAULT_ELEMENTS) {
    insertEl.run(
      uuid(), layoutId, el.field_key, el.type,
      el.x, el.y, el.w, el.h, el.rotate, el.z_index,
      el.locked, el.visible, el.background_json, el.styles_json,
      now, now,
    );
  }
})();

console.log(`Default layout seeded (${W}×${TOTAL_H}): ${layoutId}`);
console.log('Elements:', DEFAULT_ELEMENTS.map(e => `${e.field_key} @ (${e.x},${Math.round(e.y)})`).join(', '));
