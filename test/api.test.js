/* =========================================================
   接口测试：node --test test/
   每次测试用一个临时数据库，不会影响你本地的订单。
   ========================================================= */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');
const fs = require('fs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hitea-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
process.env.PORT = '0';
process.env.ADMIN_PIN = '2468';
delete process.env.STRIPE_SECRET_KEY;

const { server } = require('../server/index.js');
const WebSocket = require('ws');
let base, wsBase;

before(async () => {
  await new Promise(r => server.listening ? r() : server.once('listening', r));
  const port = server.address().port;
  base = `http://127.0.0.1:${port}`;
  wsBase = `ws://127.0.0.1:${port}/ws`;
});
after(() => { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); setTimeout(() => process.exit(0), 50); });

const api = async (method, url, body, token) => {
  const res = await fetch(base + url, {
    method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch (e) { json = text; }
  return { status: res.status, body: json };
};

const classic = { tea: 'black', milk: 'milk', sweet: 50, ice: 'normal', size: 'M', tops: ['pearl'] };
const orderBody = (over = {}) => ({
  lines: [{ drinkId: 'classic', recipe: classic, qty: 2 }, { recipe: { ...classic, tea: 'taro', tops: ['cheese', 'coco'] }, qty: 1 }],
  type: 'pickup', pickupAt: 'asap', name: 'Wenbo', phone: '5195550000', note: 'less ice pls', payment: 'store', lang: 'zh', ...over,
});

test('config, menu and slots load', async () => {
  const c = await api('GET', '/api/config');
  assert.equal(c.status, 200);
  assert.equal(c.body.payments.online, false);
  const m = await api('GET', '/api/menu');
  assert.ok(m.body.drinks.length >= 8);
  const s = await api('GET', '/api/slots');
  assert.ok(s.body.slots.length > 0);
});

test('server recomputes prices and ignores client totals', async () => {
  const r = await api('POST', '/api/orders', { ...orderBody(), total: 1, subtotal: 1 });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const o = await api('GET', `/api/orders/${r.body.id}?token=${r.body.token}`);
  // classic: 5.50 + 0.75 = 6.25 ×2 = 12.50 ; taro custom: 6.50 + 1.25 + 0.75 = 8.50 → 21.00 ; HST 13% = 2.73
  assert.equal(o.body.subtotal, 2100);
  assert.equal(o.body.tax, 273);
  assert.equal(o.body.total, 2373);
  assert.equal(o.body.status, 'new');
  assert.equal(o.body.number.length, 3);
  assert.equal(o.body.phone, undefined, 'phone must not leak to public view');
});

test('rejects bad input', async () => {
  assert.equal((await api('POST', '/api/orders', orderBody({ lines: [] }))).status, 400);
  assert.equal((await api('POST', '/api/orders', orderBody({ name: '' }))).status, 400);
  assert.equal((await api('POST', '/api/orders', orderBody({ pickupAt: '2001-01-01T00:00:00Z' }))).status, 400);
  const bad = orderBody(); bad.lines[0].recipe = { ...classic, tea: 'poison' };
  assert.equal((await api('POST', '/api/orders', bad)).status, 400);
  const many = orderBody(); many.lines[0].recipe = { ...classic, tops: ['pearl', 'coco', 'pudding', 'cheese'] };
  assert.equal((await api('POST', '/api/orders', many)).status, 400);
  const neg = orderBody(); neg.lines[0].qty = -3;
  assert.equal((await api('POST', '/api/orders', neg)).status, 400);
});

test('order lookup needs the right token', async () => {
  const r = await api('POST', '/api/orders', orderBody());
  assert.equal((await api('GET', `/api/orders/${r.body.id}?token=wrong`)).status, 404);
});

test('staff login, live order push, status flow, customer notified', async () => {
  assert.equal((await api('POST', '/api/admin/login', { pin: '0000' })).status, 401);
  const login = await api('POST', '/api/admin/login', { pin: '2468' });
  const token = login.body.token;
  assert.ok(token);
  assert.equal((await api('GET', '/api/admin/orders')).status, 401);

  const staffWs = new WebSocket(wsBase);
  const staffMsgs = [];
  await new Promise(r => staffWs.on('open', r));
  staffWs.on('message', m => staffMsgs.push(JSON.parse(m)));
  staffWs.send(JSON.stringify({ type: 'staff', token }));
  await new Promise(r => setTimeout(r, 100));

  const r = await api('POST', '/api/orders', orderBody({ type: 'table', table: 5, name: '' }));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  await new Promise(res => setTimeout(res, 150));
  const pushed = staffMsgs.find(m => m.type === 'order' && m.order.id === r.body.id);
  assert.ok(pushed, 'staff got new order live');
  assert.equal(pushed.order.table, 5);
  assert.equal(pushed.order.phone, '5195550000');

  const custWs = new WebSocket(wsBase);
  const custMsgs = [];
  await new Promise(res => custWs.on('open', res));
  custWs.on('message', m => custMsgs.push(JSON.parse(m)));
  custWs.send(JSON.stringify({ type: 'track', id: r.body.id, token: r.body.token }));
  await new Promise(res => setTimeout(res, 100));

  assert.equal((await api('POST', `/api/admin/orders/${r.body.id}/status`, { status: 'ready' }, token)).status, 400, 'cannot skip making');
  assert.equal((await api('POST', `/api/admin/orders/${r.body.id}/status`, { status: 'making' }, token)).status, 200);
  assert.equal((await api('POST', `/api/admin/orders/${r.body.id}/status`, { status: 'ready' }, token)).status, 200);
  await new Promise(res => setTimeout(res, 150));
  assert.ok(custMsgs.some(m => m.type === 'order' && m.order.status === 'ready'), 'customer told it is ready');
  assert.ok(custMsgs.every(m => m.type !== 'order' || m.order.phone === undefined), 'customer view has no phone');
  const done = await api('POST', `/api/admin/orders/${r.body.id}/status`, { status: 'done' }, token);
  assert.equal(done.body.paid, true);

  const list = await api('GET', '/api/admin/orders', null, token);
  assert.ok(list.body.length >= 3);
  staffWs.close(); custWs.close();
});

test('menu management: sold out blocks orders, validation, broadcast', async () => {
  const token = (await api('POST', '/api/admin/login', { pin: '2468' })).body.token;
  const m = (await api('GET', '/api/admin/menu', null, token)).body;
  const ws = new WebSocket(wsBase);
  const msgs = [];
  await new Promise(r => ws.on('open', r));
  ws.on('message', x => msgs.push(JSON.parse(x)));

  m.toppings.find(t => t.id === 'pearl').available = false;
  m.teas.find(t => t.id === 'black').price = 6;
  m.drinks.find(d => d.id === 'classic').price = 5.99;
  const put = await api('PUT', '/api/admin/menu', m, token);
  assert.equal(put.status, 200, JSON.stringify(put.body));
  await new Promise(r => setTimeout(r, 100));
  assert.ok(msgs.some(x => x.type === 'menu'), 'customers told menu changed');

  const r = await api('POST', '/api/orders', orderBody());
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'sold_out');

  m.toppings.find(t => t.id === 'pearl').available = true;
  await api('PUT', '/api/admin/menu', m, token);
  const r2 = await api('POST', '/api/orders', orderBody({ lines: [{ drinkId: 'classic', recipe: classic, qty: 1 }] }));
  const o = await api('GET', `/api/orders/${r2.body.id}?token=${r2.body.token}`);
  assert.equal(o.body.subtotal, 599, 'drink price override used');

  const bad = JSON.parse(JSON.stringify(m)); bad.teas[0].price = -1;
  assert.equal((await api('PUT', '/api/admin/menu', bad, token)).status, 400);
  const bad2 = JSON.parse(JSON.stringify(m)); bad2.drinks[0].preset.tea = 'nope';
  assert.equal((await api('PUT', '/api/admin/menu', bad2, token)).status, 400);

  assert.equal((await api('POST', '/api/admin/menu/reset', null, token)).status, 200);
  ws.close();
});

test('qr code and online payment fallback', async () => {
  const token = (await api('POST', '/api/admin/login', { pin: '2468' })).body.token;
  const res = await fetch(base + '/api/admin/qr?table=3', { headers: { authorization: 'Bearer ' + token } });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<svg/);
  // 没有 Stripe 密钥时，选在线支付会自动变成到店付款
  const r = await api('POST', '/api/orders', orderBody({ payment: 'online' }));
  const o = await api('GET', `/api/orders/${r.body.id}?token=${r.body.token}`);
  assert.equal(o.body.payment, 'store');
  assert.equal(o.body.status, 'new');
});
