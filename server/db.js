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

  -- 集点卡：用手机号（只保留数字）当卡号
  CREATE TABLE IF NOT EXISTS loyalty (
    phone      TEXT PRIMARY KEY,
    stamps     INTEGER NOT NULL DEFAULT 0,
    earned     INTEGER NOT NULL DEFAULT 0,    -- 历史上一共攒了多少个
    redeemed   INTEGER NOT NULL DEFAULT 0,    -- 一共兑换了几次
    updated_at TEXT NOT NULL
  );
`);

/* 数据库"迁移"：老版本的 orders 表没有这几列，启动时补上（已经有的不会重复加） */
const orderCols = db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);
[
  ['discount', 'INTEGER NOT NULL DEFAULT 0'],      // 优惠总额（分）
  ['coupon', 'TEXT'],                              // 用了哪个优惠码
  ['reward_used', 'INTEGER NOT NULL DEFAULT 0'],   // 是否用集点卡换了一杯
  ['stamps', 'INTEGER NOT NULL DEFAULT 0'],        // 这一单取餐后能攒几个印章
  ['stamped', 'INTEGER NOT NULL DEFAULT 0'],       // 印章是否已经加上了
].forEach(([name, type]) => { if (!orderCols.includes(name)) db.exec(`ALTER TABLE orders ADD COLUMN ${name} ${type}`); });

const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
const setSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

function getSettingJSON(key) {
  const row = getSetting.get(key);
  return row ? JSON.parse(row.value) : null;
}
const saveSettingJSON = (key, v) => setSetting.run(key, JSON.stringify(v));

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
                      items, subtotal, tax, total, payment, paid, stripe_session, created_at, updated_at,
                      discount, coupon, reward_used, stamps)
  VALUES (@id, @number, @token, @status, @type, @table_no, @pickup_at, @customer_name, @phone, @note, @lang,
          @items, @subtotal, @tax, @total, @payment, @paid, @stripe_session, @created_at, @updated_at,
          @discount, @coupon, @reward_used, @stamps)`);

const selectOrder = db.prepare('SELECT * FROM orders WHERE id = ?');
const selectBySession = db.prepare('SELECT * FROM orders WHERE stripe_session = ?');
const selectSince = db.prepare(`SELECT * FROM orders WHERE created_at >= ? AND status != 'awaiting_payment' ORDER BY created_at ASC`);

function rowToOrder(r) {
  if (!r) return null;
  return { ...r, items: JSON.parse(r.items), paid: !!r.paid, reward_used: !!r.reward_used, stamped: !!r.stamped };
}

function createOrder(o) {
  insertOrder.run({
    discount: 0, coupon: null, reward_used: 0, stamps: 0, ...o,
    items: JSON.stringify(o.items), paid: o.paid ? 1 : 0, reward_used: o.reward_used ? 1 : 0, stripe_session: o.stripe_session || null,
  });
  return getOrder(o.id);
}
const getOrder = id => rowToOrder(selectOrder.get(id));
const getOrderBySession = sid => rowToOrder(selectBySession.get(sid));
const ordersSince = iso => selectSince.all(iso).map(rowToOrder);

const UPDATABLE = ['status', 'paid', 'payment', 'stripe_session', 'stamped'];
function updateOrder(id, fields) {
  const keys = Object.keys(fields).filter(k => UPDATABLE.includes(k));   // 只允许改这几列
  const params = { id, updated_at: new Date().toISOString() };
  keys.forEach(k => { params[k] = typeof fields[k] === 'boolean' ? (fields[k] ? 1 : 0) : fields[k]; });
  const sets = keys.map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE orders SET ${sets}, updated_at = @updated_at WHERE id = @id`).run(params);
  return getOrder(id);
}

/* ---------- 排队：前面还有几杯 ---------- */
const queueRows = db.prepare(`SELECT id, created_at, items FROM orders WHERE status IN ('new', 'making') ORDER BY created_at ASC`);
function queue() {
  return queueRows.all().map(r => ({ id: r.id, created_at: r.created_at, drinks: JSON.parse(r.items).reduce((s, it) => s + it.qty, 0) }));
}

/* ---------- 集点卡 ---------- */
const normPhone = p => String(p || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');   // 只留数字，去掉北美的 +1
const getCard = db.prepare('SELECT * FROM loyalty WHERE phone = ?');
const upsertCard = db.prepare(`INSERT INTO loyalty (phone, stamps, earned, redeemed, updated_at) VALUES (@phone, @stamps, @earned, @redeemed, @now)
  ON CONFLICT(phone) DO UPDATE SET stamps = @stamps, earned = @earned, redeemed = @redeemed, updated_at = @now`);

function card(phone) {
  const p = normPhone(phone);
  if (p.length < 7) return null;
  return getCard.get(p) || { phone: p, stamps: 0, earned: 0, redeemed: 0 };
}

/* 改印章数：delta 可以是正数（攒）或负数（兑换、退回）。用事务保证不会出现负数 */
const changeStamps = db.transaction((phone, delta, { redeem = 0 } = {}) => {
  const c = card(phone);
  if (!c) return null;
  const stamps = c.stamps + delta;
  if (stamps < 0) return null;
  const next = { phone: c.phone, stamps, earned: c.earned + Math.max(0, delta), redeemed: c.redeemed + redeem, now: new Date().toISOString() };
  upsertCard.run(next);
  return next;
});

/* ---------- 优惠码（存在 settings 里，后台可以改） ---------- */
const getCoupons = () => getSettingJSON('coupons') || [];
const saveCoupons = list => saveSettingJSON('coupons', list);
const findCoupon = code => getCoupons().find(c => c.code.toUpperCase() === String(code || '').trim().toUpperCase()) || null;
const useCoupon = db.transaction((code, delta) => {
  const list = getCoupons();
  const c = list.find(x => x.code.toUpperCase() === String(code).toUpperCase());
  if (!c) return;
  c.uses = Math.max(0, (c.uses || 0) + delta);
  saveCoupons(list);
});

module.exports = {
  db, getMenu, saveMenu, nextNumber, createOrder, getOrder, getOrderBySession, ordersSince, updateOrder,
  queue, normPhone, card, changeStamps, getCoupons, saveCoupons, findCoupon, useCoupon, getSettingJSON, saveSettingJSON,
};
