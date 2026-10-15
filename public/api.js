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
        shop: raw.shop, theme: raw.theme, themeLight: raw.themeLight || null, features: raw.features, story: raw.story || null,
        hours: raw.hours, payments: { store: true, online: false }, menu: raw.menu,
        loyalty: raw.loyalty && raw.loyalty.enabled ? { enabled: true, stampsNeeded: raw.loyalty.stampsNeeded } : { enabled: false },
        coupons: raw.coupons || [],
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

  /* ---------- 等待时间、集点卡、优惠码 ---------- */
  async function wait(drinks) {
    if (mode === 'live') return request('GET', `api/wait?drinks=${drinks}`);
    return { queueDrinks: 3, minutes: Math.max(config.hours.prepMinutes || 10, (3 + drinks) * (config.hours.minutesPerDrink || 2) + 3) };
  }

  const normPhone = p => String(p || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  const demoStamps = () => { try { return JSON.parse(localStorage.getItem('hitea-demo-stamps') || '{}'); } catch (e) { return {}; } };
  const saveStamps = v => { try { localStorage.setItem('hitea-demo-stamps', JSON.stringify(v)); } catch (e) { /* 忽略 */ } };

  async function loyalty(phone) {
    if (mode === 'live') return request('GET', `api/loyalty?phone=${encodeURIComponent(phone)}`);
    const p = normPhone(phone);
    if (p.length < 7) { const err = new Error('bad_phone'); err.code = 'bad_phone'; throw err; }
    return { enabled: config.loyalty.enabled, stamps: demoStamps()[p] || 0, needed: config.loyalty.stampsNeeded };
  }

  async function checkCoupon(code, lines, menuNow, useReward) {
    if (mode === 'live') return request('POST', 'api/coupons/check', { code, lines, useReward });
    const c = (config.coupons || []).find(x => x.code.toUpperCase() === String(code).trim().toUpperCase());
    if (!c) { const err = new Error('coupon_invalid'); err.code = 'coupon_invalid'; throw err; }
    const d = Pricing.discounts({ lines, menu: menuNow, coupon: c, useReward });
    if (d.error) { const err = new Error(d.error); err.code = d.error; throw err; }
    return { code: c.code, label: c.label, off: d.coupon, minSubtotal: c.minSubtotal };
  }

  /* ---------- 下单 ---------- */
  async function createOrder(body, menuNow) {
    if (mode === 'live') return request('POST', 'api/orders', body);
    // 演示模式：在浏览器里算好价格和优惠，存在 localStorage
    const lines = body.lines.map(l => ({ ...l, unit: Pricing.recipeCents(l.recipe, menuNow, l.drinkId) }));
    const coupon = body.couponCode ? (config.coupons || []).find(x => x.code.toUpperCase() === body.couponCode.toUpperCase()) : null;
    const phone = normPhone(body.phone);
    const stamps = demoStamps();
    const useReward = !!body.useReward && (stamps[phone] || 0) >= config.loyalty.stampsNeeded;
    const d = Pricing.discounts({ lines, menu: menuNow, coupon, useReward });
    const tot = Pricing.totals(lines, menuNow, config.shop.taxRate, d.reward + (d.error ? 0 : d.coupon));
    if (useReward) { stamps[phone] -= config.loyalty.stampsNeeded; saveStamps(stamps); }
    const qty = lines.reduce((s, l) => s + l.qty, 0);
    const id = 'demo-' + Date.now().toString(36);
    const order = {
      id, token: 'demo', number: String(Math.floor(1 + Math.random() * 998)).padStart(3, '0'),
      type: body.type, table: body.table || null, pickupAt: body.type === 'table' ? null : body.pickupAt, name: body.name,
      items: lines.map(l => ({ drinkId: l.drinkId, name: l.drinkId ? (menuNow.drinks.find(d => d.id === l.drinkId) || {}).name : null, recipe: l.recipe, qty: l.qty, unit: l.unit })),
      ...tot, coupon: coupon && !d.error ? coupon.code : null, rewardUsed: useReward,
      phone, stamps: config.loyalty.enabled && phone.length >= 7 ? qty - (useReward ? 1 : 0) : 0, stamped: false,
      payment: 'store', paid: false, createdAt: new Date().toISOString(),
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
    // 演示模式：下单 6 秒后"制作中"，15 秒后"可以取餐"，同时把印章加上
    const age = (Date.now() - new Date(o.createdAt).getTime()) / 1000;
    const status = age < 6 ? 'new' : age < 15 ? 'making' : 'ready';
    if (status === 'ready' && o.stamps > 0 && !o.stamped) {
      const all = demoOrders(); all[id].stamped = true; saveDemo(all);
      const st = demoStamps(); st[o.phone] = (st[o.phone] || 0) + o.stamps; saveStamps(st);
      o.stamped = true;
    }
    const ahead = status === 'new' ? 3 : 0;
    const qty = o.items.reduce((s, it) => s + it.qty, 0);
    return { ...o, phone: undefined, status, ahead, etaMinutes: status === 'ready' ? 0 : Math.max(1, (ahead + qty) * (config.hours.minutesPerDrink || 2)) };
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
    init, menu, slots, wait, loyalty, checkCoupon, createOrder, getOrder, pay, payInStore, track, on, normPhone,
    get mode() { return mode; }, get config() { return config; },
  };
})();
