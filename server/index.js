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
const { validateMenu, validateCoupons } = require('./menu');
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
if (!store.getSettingJSON('coupons')) store.saveCoupons(CONFIG.coupons || []);
const LOYALTY = CONFIG.loyalty && CONFIG.loyalty.enabled ? CONFIG.loyalty : null;

// 老版本数据库里的菜单没有咖啡因、过敏原、标签这些字段：按 id 从配置文件补上
(function migrateMenu() {
  const m = store.getMenu();
  let changed = false;
  [['teas', ['caffeine']], ['milks', ['allergens']], ['toppings', ['allergens']], ['drinks', ['badge']]].forEach(([sec, fields]) => {
    (m[sec] || []).forEach(item => {
      const base = (CONFIG.menu[sec] || []).find(x => x.id === item.id);
      fields.forEach(f => { if (!(f in item)) { item[f] = base && f in base ? base[f] : (f === 'allergens' ? [] : f === 'caffeine' ? 'mid' : null); changed = true; } });
    });
  });
  if (changed) store.saveMenu(m);
})();
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
    if (process.env.RATE_LIMIT_OFF === '1' && !IS_PROD) return next();   // 只给自动测试用
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
    subtotal: o.subtotal, discount: o.discount || 0, coupon: o.coupon || null, rewardUsed: !!o.reward_used,
    tax: o.tax, total: o.total, payment: o.payment, paid: o.paid,
    stamps: o.stamps || 0, stamped: !!o.stamped,
    ...queueInfo(o),
    createdAt: o.created_at, updatedAt: o.updated_at,
  };
}

/* 排队估算：前面还有几杯、大概还要几分钟 */
const PER_DRINK = CONFIG.hours.minutesPerDrink || 2;
function queueInfo(o) {
  if (!['new', 'making'].includes(o.status)) return { ahead: 0, etaMinutes: 0 };
  let ahead = 0, mine = 0;
  for (const q of store.queue()) {
    if (q.id === o.id) { mine = q.drinks; break; }
    ahead += q.drinks;
  }
  return { ahead, etaMinutes: Math.max(1, Math.ceil((ahead + mine) * PER_DRINK)) };
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
    // 付款页面过期没付：取消订单，退回印章和优惠码次数
    if (event.type === 'checkout.session.expired') {
      const o = store.getOrderBySession(event.data.object.id);
      if (o && o.status === 'awaiting_payment') emitOrder(cancelOrder(o));
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
  const { shop, theme, hours, features, story } = CONFIG;
  res.json({
    shop, theme, story: story || null, hours: { open: hours.open, close: hours.close, prepMinutes: hours.prepMinutes, minutesPerDrink: PER_DRINK, demoAlwaysOpen: !!hours.demoAlwaysOpen },
    features, payments: { store: true, online: payments.enabled() },
    loyalty: LOYALTY ? { enabled: true, stampsNeeded: LOYALTY.stampsNeeded } : { enabled: false },
  });
});

/* 现在下单大概要等多久 */
app.get('/api/wait', (req, res) => {
  const n = Math.max(1, Math.min(30, Number(req.query.drinks) || 1));
  const queueDrinks = store.queue().reduce((s, q) => s + q.drinks, 0);
  res.json({ queueDrinks, minutes: Math.max(CONFIG.hours.prepMinutes || 10, Math.ceil((queueDrinks + n) * PER_DRINK) + 3) });
});

/* 查集点卡：只返回印章数量，不返回任何个人信息 */
app.get('/api/loyalty', rateLimit(30, 10 * 60 * 1000), (req, res) => {
  if (!LOYALTY) return res.json({ enabled: false });
  const c = store.card(req.query.phone);
  if (!c) return httpError(res, 400, 'bad_phone');
  res.json({ enabled: true, stamps: c.stamps, needed: LOYALTY.stampsNeeded });
});

/* 检查优惠码：顾客在结账页输入时用 */
app.post('/api/coupons/check', rateLimit(30, 10 * 60 * 1000), (req, res) => {
  const b = req.body || {};
  const c = store.findCoupon(b.code);
  if (!c) return httpError(res, 400, 'coupon_invalid');
  const parsed = parseLines(b.lines, menu());
  if (parsed.error) return httpError(res, 400, parsed.error);
  const d = Pricing.discounts({ lines: parsed.lines, menu: menu(), coupon: c, useReward: !!b.useReward });
  if (d.error) return httpError(res, 400, d.error);
  res.json({ code: c.code, label: c.label, off: d.coupon, minSubtotal: c.minSubtotal });
});

/* 检查购物车里的每一杯（下单和检查优惠码都用） */
function parseLines(raw, m) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 20) return { error: 'empty_cart' };
  const lines = [];
  for (const l of raw) {
    const qty = Number(l && l.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) return { error: 'bad_qty' };
    const chk = Pricing.checkRecipe(l.recipe, m, CONFIG.features.maxToppings || 3);
    if (!chk.ok) return { error: chk.error };
    const drink = l.drinkId && m.drinks.find(d => d.id === l.drinkId && d.active);
    const isPreset = drink && Pricing.sameRecipe(drink.preset, chk.recipe);
    lines.push({ drinkId: isPreset ? drink.id : null, recipe: chk.recipe, qty, name: isPreset ? drink.name : null });
  }
  if (lines.reduce((s, l) => s + l.qty, 0) > 30) return { error: 'too_many_items' };
  return { lines };
}

app.get('/api/menu', (req, res) => res.json(menu()));

app.get('/api/slots', (req, res) => res.json(pickupSlots(CONFIG.hours, CONFIG.shop.timezone)));

app.post('/api/orders', rateLimit(12, 10 * 60 * 1000), async (req, res) => {
  const b = req.body || {};
  const m = menu();
  const lang = b.lang === 'en' ? 'en' : 'zh';

  // 1. 检查每一杯
  const parsed = parseLines(b.lines, m);
  if (parsed.error) return httpError(res, 400, parsed.error);
  const lines = parsed.lines;

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

  // 3. 优惠：集点卡兑换一杯 + 优惠码
  const useReward = !!b.useReward && !!LOYALTY;
  const cardPhone = store.normPhone(phone);
  if (useReward && cardPhone.length < 7) return httpError(res, 400, 'phone_required');
  let coupon = null;
  if (b.couponCode) {
    coupon = store.findCoupon(b.couponCode);
    if (!coupon) return httpError(res, 400, 'coupon_invalid');
  }
  const d = Pricing.discounts({ lines, menu: m, useReward, coupon });
  if (d.error) return httpError(res, 400, d.error);

  // 4. 服务器自己算价格
  const t = Pricing.totals(lines, m, CONFIG.shop.taxRate, d.reward + d.coupon);
  const items = lines.map(l => ({
    drinkId: l.drinkId, name: l.name, recipe: l.recipe, qty: l.qty,
    unit: Pricing.recipeCents(l.recipe, m, l.drinkId),
  }));
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);
  // 留了手机号才能攒印章；免费的那杯不算
  const stamps = LOYALTY && cardPhone.length >= 7 ? totalQty - (useReward ? 1 : 0) : 0;

  // 先扣印章（不够就不让下单），再记一次优惠码使用
  if (useReward && !store.changeStamps(cardPhone, -LOYALTY.stampsNeeded, { redeem: 1 })) return httpError(res, 400, 'not_enough_stamps');
  if (coupon) store.useCoupon(coupon.code, 1);

  // 5. 付款方式
  const payment = b.payment === 'online' && payments.enabled() && t.total > 0 ? 'online' : 'store';
  const now = new Date().toISOString();
  const order = store.createOrder({
    id: newId(), token: newToken(), number: store.nextNumber(partsIn(new Date(), CONFIG.shop.timezone).day),
    status: payment === 'online' ? 'awaiting_payment' : 'new',
    type, table_no: tableNo, pickup_at: pickupAt, customer_name: name, phone, note, lang,
    items, subtotal: t.subtotal, tax: t.tax, total: t.total, payment, paid: t.total === 0,
    discount: t.discount, coupon: coupon ? coupon.code : null, reward_used: useReward, stamps,
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
  let lineItems = order.items.map(it => ({
    name: it.name ? L(it.name, lang) : (lang === 'en' ? 'Custom drink' : '我的特调'),
    description: describeRecipe(it.recipe, m, lang),
    unit: it.unit, qty: it.qty,
  }));
  // 有优惠时，Stripe 的单价不能是负数，所以合并成一行"订单 #xxx"，金额是优惠后的小计
  if (order.discount > 0) {
    lineItems = [{
      name: `${CONFIG.shop.name} #${order.number}`,
      description: lineItems.map(li => `${li.qty}× ${li.name}`).join(', ') + (lang === 'en' ? ' (discount applied)' : '（已优惠）'),
      unit: order.subtotal - order.discount, qty: 1,
    }];
  }
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

/* 取消订单：退回兑换用掉的印章、退回优惠码次数 */
function cancelOrder(o) {
  if (o.reward_used && LOYALTY) store.changeStamps(o.phone, LOYALTY.stampsNeeded, { redeem: -1 });
  if (o.coupon) store.useCoupon(o.coupon, -1);
  return store.updateOrder(o.id, { status: 'cancelled' });
}
app.post('/api/admin/orders/:id/status', requireStaff, (req, res) => {
  const o = store.getOrder(req.params.id);
  if (!o) return httpError(res, 404, 'not_found');
  const to = (req.body || {}).status;
  if (!(NEXT[o.status] || []).includes(to)) return httpError(res, 400, 'bad_transition');
  if (to === 'cancelled') { const o2 = cancelOrder(o); emitOrder(o2); return res.json(staffOrder(o2)); }
  const fields = { status: to };
  if (to === 'done' && o.payment === 'store') fields.paid = true;   // 到店付款的，取走时就算付了
  // 取走了：给集点卡加印章
  if (to === 'done' && LOYALTY && o.stamps > 0 && !o.stamped && store.changeStamps(o.phone, o.stamps)) fields.stamped = true;
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

app.get('/api/admin/coupons', requireStaff, (req, res) => res.json(store.getCoupons()));

app.put('/api/admin/coupons', requireStaff, (req, res) => {
  try {
    const list = validateCoupons(req.body);
    // 使用次数以服务器记录为准，不让后台随便改
    const old = store.getCoupons();
    list.forEach(c => { const o = old.find(x => x.code === c.code); c.uses = o ? o.uses || 0 : 0; });
    store.saveCoupons(list);
    res.json(list);
  } catch (e) { httpError(res, e.status || 500, e.status ? 'invalid_coupons: ' + e.message : 'server_error'); }
});

app.get('/api/admin/loyalty', requireStaff, (req, res) => {
  const c = store.card(req.query.phone);
  if (!c) return httpError(res, 400, 'bad_phone');
  res.json({ ...c, needed: LOYALTY ? LOYALTY.stampsNeeded : null });
});

// 店里现场买的（没在网上下单）也能手动加印章
app.post('/api/admin/loyalty', requireStaff, (req, res) => {
  const delta = Number((req.body || {}).delta);
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 50) return httpError(res, 400, 'bad_delta');
  const c = store.changeStamps((req.body || {}).phone, delta);
  if (!c) return httpError(res, 400, 'bad_phone_or_not_enough');
  res.json({ ...c, needed: LOYALTY ? LOYALTY.stampsNeeded : null });
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
