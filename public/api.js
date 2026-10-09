/* =========================================================
   api.js：和服务器打交道的地方
   页面上所有"读菜单、下单、查订单、实时更新"都通过这里。

   两种模式：
   - live：连上了服务器（npm start 或部署到 Render 后）
   - demo：没有服务器（比如放在 GitHub Pages 上），菜单读 shop.config.json，
           订单只存在这台设备上，并且自动模拟"制作中 → 可以取餐"
   ========================================================= */
const Api = (() => {
  let mode = 'demo';
  let config = null;
  let ws = null;
  let wsRetry = 0;
  let tracking = null;                 // 正在跟踪的订单 { id, token }
  const listeners = { order: [], menu: [], status: [] };

  // 用相对路径，这样不管网站放在根目录还是子目录（GitHub Pages）都能用
  const url = p => new URL(p, location.href).toString();

  async function request(method, path, body) {
    let res;
    try {
      res = await fetch(url(path), {
        method, headers: body ? { 'content-type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      const err = new Error('network'); err.code = 'network'; throw err;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const err = new Error(data.error || 'error'); err.code = data.error || 'generic'; err.status = res.status; throw err; }
    return data;
  }

  /* 启动：先试试能不能连上服务器，4 秒没反应就进入演示模式 */
  async function init() {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(url('api/config'), { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error('no api');
      config = await res.json();
      mode = 'live';
    } catch (e) {
      const raw = await (await fetch(url('shop.config.json'))).json();
      config = {
        shop: raw.shop, theme: raw.theme, features: raw.features,
        hours: raw.hours, payments: { store: true, online: false }, menu: raw.menu,
      };
      mode = 'demo';
    }
    if (mode === 'live') connect();
    return config;
  }

  async function menu() {
    if (mode === 'demo') return JSON.parse(JSON.stringify(config.menu));
    return request('GET', 'api/menu');
  }

  async function slots() {
    if (mode === 'live') return request('GET', 'api/slots');
    // 演示模式：从现在起每 15 分钟一个时间格
    const step = (config.hours.slotMinutes || 15) * 60000;
    const first = Math.ceil((Date.now() + (config.hours.prepMinutes || 10) * 60000) / step) * step;
    return { open: true, slots: Array.from({ length: 12 }, (_, i) => new Date(first + i * step).toISOString()) };
  }

  /* ---------- 下单 ---------- */
  async function createOrder(body, menuNow) {
    if (mode === 'live') return request('POST', 'api/orders', body);
    // 演示模式：在浏览器里算好价格，存在 localStorage
    const lines = body.lines.map(l => ({ ...l, unit: Pricing.recipeCents(l.recipe, menuNow, l.drinkId) }));
    const tot = Pricing.totals(lines, menuNow, config.shop.taxRate);
    const id = 'demo-' + Date.now().toString(36);
    const order = {
      id, token: 'demo', number: String(Math.floor(1 + Math.random() * 998)).padStart(3, '0'),
      type: body.type, table: body.table || null, pickupAt: body.type === 'table' ? null : body.pickupAt, name: body.name,
      items: lines.map(l => ({ drinkId: l.drinkId, name: l.drinkId ? (menuNow.drinks.find(d => d.id === l.drinkId) || {}).name : null, recipe: l.recipe, qty: l.qty, unit: l.unit })),
      ...tot, payment: 'store', paid: false, createdAt: new Date().toISOString(),
    };
    const all = demoOrders();
    all[id] = order;
    saveDemo(all);
    return { id, token: 'demo', number: order.number };
  }

  const demoOrders = () => { try { return JSON.parse(localStorage.getItem('hitea-demo-orders') || '{}'); } catch (e) { return {}; } };
  const saveDemo = all => { try { localStorage.setItem('hitea-demo-orders', JSON.stringify(all)); } catch (e) { /* 忽略 */ } };

  async function getOrder(id, token) {
    if (mode === 'live') return request('GET', `api/orders/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`);
    const o = demoOrders()[id];
    if (!o) { const err = new Error('not_found'); err.code = 'not_found'; throw err; }
    // 演示模式：下单 6 秒后"制作中"，15 秒后"可以取餐"
    const age = (Date.now() - new Date(o.createdAt).getTime()) / 1000;
    return { ...o, status: age < 6 ? 'new' : age < 15 ? 'making' : 'ready' };
  }

  const pay = (id, token) => request('POST', `api/orders/${encodeURIComponent(id)}/pay`, { token });
  const payInStore = (id, token) => request('POST', `api/orders/${encodeURIComponent(id)}/pay-in-store`, { token });

  /* ---------- 实时连接 ---------- */
  function connect() {
    const u = new URL('ws', location.href);
    u.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(u);
    ws.onopen = () => {
      wsRetry = 0;
      emit('status', true);
      if (tracking) ws.send(JSON.stringify({ type: 'track', ...tracking }));
    };
    ws.onmessage = e => {
      let msg; try { msg = JSON.parse(e.data); } catch (err) { return; }
      if (msg.type === 'order') emit('order', msg.order);
      if (msg.type === 'menu') emit('menu');
    };
    ws.onclose = () => {
      emit('status', false);
      // 断线后自动重连，等待时间越来越长（1s, 2s, 4s… 最多 30s）
      const delay = Math.min(30000, 1000 * Math.pow(2, wsRetry++));
      setTimeout(connect, delay);
    };
  }

  function track(id, token) {
    tracking = { id, token };
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'track', id, token }));
  }

  const on = (type, fn) => listeners[type].push(fn);
  const emit = (type, data) => listeners[type].forEach(fn => fn(data));

  return {
    init, menu, slots, createOrder, getOrder, pay, payInStore, track, on,
    get mode() { return mode; }, get config() { return config; },
  };
})();
