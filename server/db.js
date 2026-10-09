/* =========================================================
   db.js：数据库（SQLite）
   SQLite 是一个"文件型"数据库：整个数据库就是 data/hitea.db 这一个文件，
   不用另外装数据库软件，很适合小店。

   两张表：
   - settings：键值对，存菜单（JSON）和每天的订单流水号
   - orders：订单
   ========================================================= */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'hitea.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');   // 读写可以同时进行，速度更快

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS orders (
    id             TEXT PRIMARY KEY,
    number         TEXT NOT NULL,
    token          TEXT NOT NULL,
    status         TEXT NOT NULL,          -- awaiting_payment / new / making / ready / done / cancelled
    type           TEXT NOT NULL,          -- pickup 自取 / table 堂食
    table_no       INTEGER,
    pickup_at      TEXT,                   -- 'asap' 或 ISO 时间
    customer_name  TEXT,
    phone          TEXT,
    note           TEXT,
    lang           TEXT,
    items          TEXT NOT NULL,          -- JSON：每一杯的配方、名字、单价、数量
    subtotal       INTEGER NOT NULL,       -- 金额都用"分"
    tax            INTEGER NOT NULL,
    total          INTEGER NOT NULL,
    payment        TEXT NOT NULL,          -- store 到店付 / online 在线付
    paid           INTEGER NOT NULL DEFAULT 0,
    stripe_session TEXT,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
`);

const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
const setSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

function getMenu() {
  const row = getSetting.get('menu');
  return row ? JSON.parse(row.value) : null;
}
function saveMenu(menu) {
  setSetting.run('menu', JSON.stringify(menu));
}

/* 每天的流水号：从 001 开始。用事务保证两个订单同时进来也不会拿到同一个号 */
const nextNumber = db.transaction(day => {
  const key = 'seq:' + day;
  const row = getSetting.get(key);
  const n = row ? Number(row.value) + 1 : 1;
  setSetting.run(key, String(n));
  return String(n).padStart(3, '0');
});

const insertOrder = db.prepare(`
  INSERT INTO orders (id, number, token, status, type, table_no, pickup_at, customer_name, phone, note, lang,
                      items, subtotal, tax, total, payment, paid, stripe_session, created_at, updated_at)
  VALUES (@id, @number, @token, @status, @type, @table_no, @pickup_at, @customer_name, @phone, @note, @lang,
          @items, @subtotal, @tax, @total, @payment, @paid, @stripe_session, @created_at, @updated_at)`);

const selectOrder = db.prepare('SELECT * FROM orders WHERE id = ?');
const selectBySession = db.prepare('SELECT * FROM orders WHERE stripe_session = ?');
const selectSince = db.prepare(`SELECT * FROM orders WHERE created_at >= ? AND status != 'awaiting_payment' ORDER BY created_at ASC`);

function rowToOrder(r) {
  if (!r) return null;
  return { ...r, items: JSON.parse(r.items), paid: !!r.paid };
}

function createOrder(o) {
  insertOrder.run({ ...o, items: JSON.stringify(o.items), paid: o.paid ? 1 : 0, stripe_session: o.stripe_session || null });
  return getOrder(o.id);
}
const getOrder = id => rowToOrder(selectOrder.get(id));
const getOrderBySession = sid => rowToOrder(selectBySession.get(sid));
const ordersSince = iso => selectSince.all(iso).map(rowToOrder);

const UPDATABLE = ['status', 'paid', 'payment', 'stripe_session'];
function updateOrder(id, fields) {
  const keys = Object.keys(fields).filter(k => UPDATABLE.includes(k));   // 只允许改这几列
  const params = { id, updated_at: new Date().toISOString() };
  keys.forEach(k => { params[k] = typeof fields[k] === 'boolean' ? (fields[k] ? 1 : 0) : fields[k]; });
  const sets = keys.map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE orders SET ${sets}, updated_at = @updated_at WHERE id = @id`).run(params);
  return getOrder(id);
}

module.exports = { db, getMenu, saveMenu, nextNumber, createOrder, getOrder, getOrderBySession, ordersSince, updateOrder };
