/* =========================================================
   index.js：服务器入口
   启动：npm start，然后打开 http://localhost:3000

   接口一览（REST API）
   顾客
     GET  /api/config              店铺信息、营业时间、是否能在线支付
     GET  /api/menu                菜单（含售罄状态）
     GET  /api/slots               今天还能选的取餐时间
     POST /api/orders              下单
     GET  /api/orders/:id?token=   查订单状态
     POST /api/orders/:id/pay      重新发起在线支付
     POST /api/orders/:id/pay-in-store   改成到店付款
   店员（需要先登录拿 token）
     POST /api/admin/login         用 PIN 登录
     GET  /api/admin/orders        今天的订单
     POST /api/admin/orders/:id/status   改订单状态
     GET  /api/admin/menu          读菜单
     PUT  /api/admin/menu          保存菜单
     POST /api/admin/menu/reset    恢复配置文件里的默认菜单
     GET  /api/admin/qr?table=5    桌号二维码（SVG）
   Stripe
     POST /api/stripe/webhook      Stripe 通知"付款成功"
   ========================================================= */
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const QRCode = require('qrcode');

// 读取 .env 文件里的设置（Node 20.12+ 自带这个功能）
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile) && process.loadEnvFile) process.loadEnvFile(envFile);

const Pricing = require('../public/pricing.js');
const store = require('./db');
const { pickupSlots, partsIn } = require('./time');
const { validateMenu } = require('./menu');
const { createRealtime } = require('./realtime');
const payments = require('./stripe');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const CONFIG = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'shop.config.json'), 'utf8'));
const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// 店员 PIN：生产环境必须自己设置；本地开发默认 1234
const ADMIN_PIN = process.env.ADMIN_PIN || (IS_PROD ? null : '1234');
if (!ADMIN_PIN) console.warn('⚠️  没有设置 ADMIN_PIN，店员后台无法登录。请在环境变量里设置。');
else if (!process.env.ADMIN_PIN) console.warn('⚠️  店员 PIN 使用默认值 1234，只适合本地开发。');

// 第一次启动：把配置文件里的菜单写进数据库
if (!store.getMenu()) store.saveMenu(CONFIG.menu);
const menu = () => store.getMenu();

/* ---------- 小工具 ---------- */
const newId = () => crypto.randomUUID();
const newToken = () => crypto.randomBytes(16).toString('hex');
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '');
const L = (obj, lang) => (obj && typeof obj === 'object' ? obj[lang] || obj.zh : obj);

function httpError(res, status, code) { return res.status(status).json({ error: code }); }

/* 简单的限流：同一个 IP 在一段时间内最多请求几次，防止有人乱刷 */
function rateLimit(max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const list = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (list.length >= max) return httpError(res, 429, 'too_many_requests');
    list.push(now);
    hits.set(key, list);
    next();
  };
}

/* 订单给顾客看的样子：不包含电话等隐私，也不包含 token */
function publicOrder(o) {
  return {
    id: o.id, number: o.number, status: o.status, type: o.type, table: o.table_no,
    pickupAt: o.pickup_at, name: o.customer_name, items: o.items,
    subtotal: o.subtotal, tax: o.tax, total: o.total, payment: o.payment, paid: o.paid,
    createdAt: o.created_at, updatedAt: o.updated_at,
  };
}
const staffOrder = o => ({ ...publicOrder(o), phone: o.phone, note: o.note, lang: o.lang });

/* ---------- 店员登录状态：存在内存里，12 小时过期 ---------- */
const staffSessions = new Map();
const SESSION_MS = 12 * 60 * 60 * 1000;
function isStaffToken(t) {
  const exp = typeof t === 'string' && staffSessions.get(t);
  if (!exp) return false;
  if (exp < Date.now()) { staffSessions.delete(t); return false; }
  return true;
}
function requireStaff(req, res, next) {
  const t = (req.get('authorization') || '').replace(/^Bearer /, '');
  if (!isStaffToken(t)) return httpError(res, 401, 'unauthorized');
  next();
}

/* ---------- 启动 Express 和 WebSocket ---------- */
const app = express();
app.set('trust proxy', 1);          // 部署在 Render 这类平台后面时，才能拿到真实的 IP 和 https
app.disable('x-powered-by');
const server = http.createServer(app);
const realtime = createRealtime(server, {
  isStaffToken,
  checkOrderToken: (id, token) => {
    const o = typeof id === 'string' && store.getOrder(id);
    return !!o && safeEqual(o.token, token);
  },
});

function emitOrder(o) { realtime.orderChanged(staffOrder(o), publicOrder(o)); }

// 安全相关的响应头
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  res.set('X-Frame-Options', 'DENY');
  next();
});

// Stripe 的 webhook 需要原始请求体来验证签名，所以要放在 express.json() 前面
app.post('/api/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  try {
    const event = payments.verifyWebhook(req.body, req.get('stripe-signature'));
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      const o = store.getOrderBySession(s.id);
      if (o && !o.paid && s.payment_status === 'paid') {
        emitOrder(store.updateOrder(o.id, { paid: true, status: o.status === 'awaiting_payment' ? 'new' : o.status }));
      }
    }
    res.json({ received: true });
  } catch (e) {
    console.error('webhook error:', e.message);
    res.status(400).send('webhook error');
  }
});

app.use(express.json({ limit: '64kb' }));

/* ================= 顾客接口 ================= */
app.get('/api/config', (req, res) => {
  const { shop, theme, hours, features } = CONFIG;
  res.json({
    shop, theme, hours: { open: hours.open, close: hours.close, prepMinutes: hours.prepMinutes, demoAlwaysOpen: !!hours.demoAlwaysOpen },
    features, payments: { store: true, online: payments.enabled() },
  });
});

app.get('/api/menu', (req, res) => res.json(menu()));

app.get('/api/slots', (req, res) => res.json(pickupSlots(CONFIG.hours, CONFIG.shop.timezone)));

app.post('/api/orders', rateLimit(12, 10 * 60 * 1000), async (req, res) => {
  const b = req.body || {};
  const m = menu();
  const lang = b.lang === 'en' ? 'en' : 'zh';

  // 1. 检查每一杯
  if (!Array.isArray(b.lines) || b.lines.length < 1 || b.lines.length > 20) return httpError(res, 400, 'empty_cart');
  const lines = [];
  for (const l of b.lines) {
    const qty = Number(l.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) return httpError(res, 400, 'bad_qty');
    const chk = Pricing.checkRecipe(l.recipe, m, CONFIG.features.maxToppings || 3);
    if (!chk.ok) return httpError(res, 400, chk.error);
    const drink = l.drinkId && m.drinks.find(d => d.id === l.drinkId && d.active);
    const isPreset = drink && Pricing.sameRecipe(drink.preset, chk.recipe);
    lines.push({ drinkId: isPreset ? drink.id : null, recipe: chk.recipe, qty, name: isPreset ? drink.name : null });
  }
  if (lines.reduce((s, l) => s + l.qty, 0) > 30) return httpError(res, 400, 'too_many_items');

  // 2. 取餐方式和时间
  let type = b.type === 'table' && CONFIG.features.tableOrdering ? 'table' : 'pickup';
  let tableNo = null, pickupAt = null;
  const slotInfo = pickupSlots(CONFIG.hours, CONFIG.shop.timezone);
  if (!slotInfo.open && type === 'table') return httpError(res, 400, 'closed');
  if (type === 'table') {
    tableNo = Number(b.table);
    if (!Number.isInteger(tableNo) || tableNo < 1 || tableNo > 99) return httpError(res, 400, 'bad_table');
  } else {
    if (b.pickupAt === 'asap') {
      if (!slotInfo.open) return httpError(res, 400, 'closed');
      pickupAt = 'asap';
    } else if (slotInfo.slots.includes(b.pickupAt)) {
      pickupAt = b.pickupAt;
    } else return httpError(res, 400, 'bad_pickup_time');
  }
  const name = clean(b.name, 30);
  if (type === 'pickup' && !name) return httpError(res, 400, 'name_required');
  const phone = clean(b.phone, 20);
  const note = clean(b.note, 140);

  // 3. 服务器自己算价格
  const t = Pricing.totals(lines, m, CONFIG.shop.taxRate);
  const items = lines.map(l => ({
    drinkId: l.drinkId, name: l.name, recipe: l.recipe, qty: l.qty,
    unit: Pricing.recipeCents(l.recipe, m, l.drinkId),
  }));

  // 4. 付款方式
  const payment = b.payment === 'online' && payments.enabled() ? 'online' : 'store';
  const now = new Date().toISOString();
  const order = store.createOrder({
    id: newId(), token: newToken(), number: store.nextNumber(partsIn(new Date(), CONFIG.shop.timezone).day),
    status: payment === 'online' ? 'awaiting_payment' : 'new',
    type, table_no: tableNo, pickup_at: pickupAt, customer_name: name, phone, note, lang,
    items, subtotal: t.subtotal, tax: t.tax, total: t.total, payment, paid: false,
    created_at: now, updated_at: now,
  });

  if (payment === 'online') {
    try {
      const url = await startCheckout(order, req, m);
      return res.status(201).json({ id: order.id, token: order.token, number: order.number, checkoutUrl: url });
    } catch (e) {
      console.error('stripe error:', e.message);
      // 在线支付出问题时不要让顾客白下单：改成到店付款
      const o2 = store.updateOrder(order.id, { payment: 'store', status: 'new' });
      emitOrder(o2);
      return res.status(201).json({ id: o2.id, token: o2.token, number: o2.number, paymentFallback: true });
    }
  }
  emitOrder(order);
  res.status(201).json({ id: order.id, token: order.token, number: order.number });
});

function baseUrl(req) {
  return (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

async function startCheckout(order, req, m) {
  const lang = order.lang;
  const lineItems = order.items.map(it => ({
    name: it.name ? L(it.name, lang) : (lang === 'en' ? 'Custom drink' : '我的特调'),
    description: describeRecipe(it.recipe, m, lang),
    unit: it.unit, qty: it.qty,
  }));
  const back = `${baseUrl(req)}/?order=${order.id}&token=${order.token}`;
  const session = await payments.createCheckout({
    lineItems, tax: order.tax, taxName: CONFIG.shop.taxName, currency: CONFIG.shop.currency,
    successUrl: back + '&paid=1', cancelUrl: back + '&canceled=1', orderId: order.id, number: order.number, locale: lang,
  });
  store.updateOrder(order.id, { stripe_session: session.id });
  return session.url;
}

function describeRecipe(r, m, lang) {
  const f = (list, id) => L((list.find(x => String(x.id) === String(id)) || {}).name, lang) || id;
  return [f(m.sizes, r.size), f(m.teas, r.tea), f(m.milks, r.milk), f(m.sweets, r.sweet), f(m.ices, r.ice), ...r.tops.map(t => f(m.toppings, t))].join(', ');
}

/* 顾客查订单：必须带上下单时拿到的 token，别人猜不到 */
function loadOwnOrder(req, res) {
  const o = store.getOrder(req.params.id);
  const token = req.query.token || (req.body && req.body.token);
  if (!o || !safeEqual(o.token, token || '')) { httpError(res, 404, 'not_found'); return null; }
  return o;
}

app.get('/api/orders/:id', async (req, res) => {
  let o = loadOwnOrder(req, res);
  if (!o) return;
  // 从 Stripe 付款页面跳回来时，主动问一下 Stripe 付了没有（本地开发收不到 webhook 时也能用）
  if (o.status === 'awaiting_payment' && o.stripe_session && payments.enabled()) {
    try {
      const s = await payments.getSession(o.stripe_session);
      if (s.payment_status === 'paid') { o = store.updateOrder(o.id, { paid: true, status: 'new' }); emitOrder(o); }
    } catch (e) { console.error('stripe check:', e.message); }
  }
  res.json(publicOrder(o));
});

app.post('/api/orders/:id/pay', rateLimit(10, 10 * 60 * 1000), async (req, res) => {
  const o = loadOwnOrder(req, res);
  if (!o) return;
  if (o.status !== 'awaiting_payment' || !payments.enabled()) return httpError(res, 400, 'cannot_pay');
  try { res.json({ checkoutUrl: await startCheckout(o, req, menu()) }); }
  catch (e) { console.error(e.message); httpError(res, 502, 'payment_unavailable'); }
});

app.post('/api/orders/:id/pay-in-store', (req, res) => {
  const o = loadOwnOrder(req, res);
  if (!o) return;
  if (o.status !== 'awaiting_payment') return httpError(res, 400, 'cannot_change');
  const o2 = store.updateOrder(o.id, { payment: 'store', status: 'new' });
  emitOrder(o2);
  res.json(publicOrder(o2));
});

/* ================= 店员接口 ================= */
app.post('/api/admin/login', rateLimit(6, 60 * 1000), (req, res) => {
  if (!ADMIN_PIN) return httpError(res, 503, 'pin_not_configured');
  if (!safeEqual(String((req.body || {}).pin || ''), ADMIN_PIN)) return httpError(res, 401, 'wrong_pin');
  const token = newToken();
  staffSessions.set(token, Date.now() + SESSION_MS);
  res.json({ token });
});

app.get('/api/admin/orders', requireStaff, (req, res) => {
  // 今天（按店铺时区）的订单，再加上之前还没处理完的
  const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
  const today = partsIn(new Date(), CONFIG.shop.timezone).day;
  const list = store.ordersSince(since).filter(o =>
    partsIn(new Date(o.created_at), CONFIG.shop.timezone).day === today || ['new', 'making', 'ready'].includes(o.status));
  res.json(list.map(staffOrder));
});

// 订单状态只能按顺序往前走（或者取消）
const NEXT = { new: ['making', 'cancelled'], making: ['ready', 'cancelled'], ready: ['done'], done: [], cancelled: [] };
app.post('/api/admin/orders/:id/status', requireStaff, (req, res) => {
  const o = store.getOrder(req.params.id);
  if (!o) return httpError(res, 404, 'not_found');
  const to = (req.body || {}).status;
  if (!(NEXT[o.status] || []).includes(to)) return httpError(res, 400, 'bad_transition');
  const fields = { status: to };
  if (to === 'done' && o.payment === 'store') fields.paid = true;   // 到店付款的，取走时就算付了
  const o2 = store.updateOrder(o.id, fields);
  emitOrder(o2);
  res.json(staffOrder(o2));
});

app.get('/api/admin/menu', requireStaff, (req, res) => res.json(menu()));

app.put('/api/admin/menu', requireStaff, (req, res) => {
  try {
    const m = validateMenu(req.body, CONFIG.menu);
    store.saveMenu(m);
    realtime.menuChanged();
    res.json(m);
  } catch (e) {
    httpError(res, e.status || 500, e.status ? 'invalid_menu: ' + e.message : 'server_error');
  }
});

app.post('/api/admin/menu/reset', requireStaff, (req, res) => {
  store.saveMenu(CONFIG.menu);
  realtime.menuChanged();
  res.json(CONFIG.menu);
});

app.get('/api/admin/qr', requireStaff, async (req, res) => {
  const table = Number(req.query.table);
  if (!Number.isInteger(table) || table < 1 || table > 99) return httpError(res, 400, 'bad_table');
  const url = `${baseUrl(req)}/?table=${table}`;
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: CONFIG.theme.ink, light: '#FFFFFF' } });
  res.type('image/svg+xml').send(svg);
});

app.use('/api', (req, res) => httpError(res, 404, 'not_found'));

/* ================= 静态文件（前端页面） ================= */
app.use(express.static(PUBLIC_DIR, { extensions: ['html'], maxAge: IS_PROD ? '1h' : 0 }));

// 出错时不要把错误细节发给浏览器
app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === 'entity.parse.failed') return httpError(res, 400, 'bad_json');
  httpError(res, 500, 'server_error');
});

server.listen(PORT, () => {
  console.log(`🧋 ${CONFIG.shop.name} 已启动：http://localhost:${PORT}`);
  console.log(`   店员后台：http://localhost:${PORT}/admin.html`);
  console.log(`   在线支付：${payments.enabled() ? 'Stripe 已开启' : '未开启（没有设置 STRIPE_SECRET_KEY）'}`);
});

module.exports = { app, server };
