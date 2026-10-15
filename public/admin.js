/* =========================================================
   admin.js：店员后台
   1. 登录（PIN）
   2. 订单看板：新订单实时出现，点按钮推进状态，顾客手机同步更新
   3. 菜单管理：改名字、价格、售罄，加减饮品，不用改代码
   4. 桌号二维码：生成、打印，贴在桌上扫码点单
   5. 优惠码与集点卡：增删优惠码，查顾客印章、现场加章
   ========================================================= */
I18N.extend('zh', {
  'a.title': '店员后台', 'a.loginTitle': '输入店员 PIN 登录', 'a.pin': 'PIN', 'a.login': '登录',
  'a.wrongPin': 'PIN 不对，再试一次', 'a.tooMany': '试太多次了，请等一分钟', 'a.pinMissing': '服务器还没设置 ADMIN_PIN',
  'a.noServer': '没有连上服务器。店员后台需要先运行 npm start，或者打开部署在 Render 上的网址。',
  'a.tabOrders': '订单', 'a.tabMenu': '菜单', 'a.tabQr': '桌号二维码',
  'a.alert': '新单提醒', 'a.logout': '退出', 'a.live': '实时连接中', 'a.offline': '连接断开，正在重连…',
  'a.waitingPickup': '等待取餐', 'a.doneToday': '今天已完成', 'a.doneSummary': '{n} 单 · {total}',
  'a.empty': '暂时没有', 'a.start': '开始制作', 'a.ready': '做好了 · 通知顾客', 'a.picked': '已取走',
  'a.cancel': '取消', 'a.confirmCancel': '确定取消？', 'a.pickup': '自取', 'a.asap': '尽快',
  'a.table': '{n} 号桌', 'a.paid': '已在线付款', 'a.payStore': '到店付款', 'a.agoMin': '{n} 分钟前', 'a.justNow': '刚刚',
  'a.newOrder': '新订单 #{n}', 'a.due': '快到取餐时间了',
  'a.menuHint': '改完记得点右下角"保存"。取消勾选"有货"就是售罄，顾客那边会马上看到。',
  'a.drinks': '招牌饮品', 'a.teas': '茶底', 'a.milks': '奶', 'a.sizes': '杯型', 'a.toppings': '小料',
  'a.onMenu': '上架', 'a.inStock': '有货', 'a.nameZh': '中文名', 'a.nameEn': '英文名', 'a.shortZh': '转盘短名', 'a.shortEn': '短名(英)',
  'a.priceDrink': '价格(空=自动)', 'a.descZh': '中文介绍', 'a.descEn': '英文介绍', 'a.price': '价格', 'a.priceAuto': '自动：{p}', 'a.colorTop': '上层颜色', 'a.colorBottom': '下层颜色',
  'a.colorLight': '高光色', 'a.colorDark': '阴影色', 'a.recipe': '配方', 'a.add': '+ 新增', 'a.delete': '删除',
  'a.save': '保存菜单', 'a.saved': '已保存，顾客页面已更新', 'a.unsaved': '有改动还没保存', 'a.saveFail': '保存失败：{e}',
  'a.resetMenu': '恢复默认菜单', 'a.confirmReset': '确定恢复？所有改动会丢失', 'a.inUse': '有招牌饮品在用它，先改掉那些饮品',
  'a.newDrink': '新饮品', 'a.newTea': '新茶底', 'a.newTopping': '新小料',
  'a.tables': '桌子数量', 'a.makeQr': '生成二维码', 'a.print': '打印', 'a.qrHint': '顾客扫码会打开：{url}',
  'a.scan': '扫码点单 · Scan to order',
  'a.tabPromo': '优惠与集点', 'a.coupons': '优惠码', 'a.loyalty': '集点卡',
  'a.couponHint': '顾客结账时输入优惠码。"满"是小计满多少才能用；"次数上限"留空就是不限次数；到期日留空就是一直有效。',
  'a.cpCode': '优惠码', 'a.cpType': '类型', 'a.cpAmount': '减金额 $', 'a.cpPercent': '打折 %', 'a.cpValue': '数值', 'a.cpMin': '满 $',
  'a.cpMax': '次数上限', 'a.cpExpires': '到期日', 'a.cpLabelZh': '中文说明', 'a.cpLabelEn': '英文说明', 'a.cpActive': '启用', 'a.cpUses': '已用 {n} 次',
  'a.saveCoupons': '保存优惠码', 'a.cpSaved': '优惠码已保存', 'a.newCoupon': 'NEWCODE',
  'a.loyHint': '每取走一杯自动攒 1 个印章，集满 {n} 个换一杯。在店里现场买的，也可以在这里手动加印章。',
  'a.loyOff': '集点卡在 shop.config.json 里关掉了。', 'a.phonePh': '顾客手机号', 'a.lookup': '查询',
  'a.loyStat': '现在 {s} 个印章 · 累计攒了 {e} 个 · 兑换过 {r} 次', 'a.addStamp': '+{n} 个', 'a.removeStamp': '−1 个', 'a.redeemNow': '现场兑换一杯（−{n}）',
  'a.loyBad': '手机号不对，或者印章不够', 'a.loyDone': '已更新',
  'a.badge': '标签', 'a.badgeNone': '无', 'a.caffeine': '咖啡因', 'a.allergens': '过敏原',
  'a.oReward': '集点兑换 1 杯', 'a.oCoupon': '优惠码 {c}', 'a.oDiscount': '已减 {d}', 'a.oStamps': '+{n} 印章',
});
I18N.extend('en', {
  'a.title': 'Staff', 'a.loginTitle': 'Enter the staff PIN', 'a.pin': 'PIN', 'a.login': 'Log in',
  'a.wrongPin': 'Wrong PIN, try again', 'a.tooMany': 'Too many tries, wait a minute', 'a.pinMissing': 'ADMIN_PIN is not set on the server',
  'a.noServer': 'No server connected. Run npm start, or open the site deployed on Render.',
  'a.tabOrders': 'Orders', 'a.tabMenu': 'Menu', 'a.tabQr': 'Table QR codes',
  'a.alert': 'Alerts', 'a.logout': 'Log out', 'a.live': 'Live', 'a.offline': 'Disconnected, reconnecting…',
  'a.waitingPickup': 'Waiting for pickup', 'a.doneToday': 'Done today', 'a.doneSummary': '{n} orders · {total}',
  'a.empty': 'Nothing here', 'a.start': 'Start making', 'a.ready': 'Ready · notify customer', 'a.picked': 'Picked up',
  'a.cancel': 'Cancel', 'a.confirmCancel': 'Really cancel?', 'a.pickup': 'Pickup', 'a.asap': 'ASAP',
  'a.table': 'Table {n}', 'a.paid': 'Paid online', 'a.payStore': 'Pay at counter', 'a.agoMin': '{n} min ago', 'a.justNow': 'just now',
  'a.newOrder': 'New order #{n}', 'a.due': 'Pickup time is close',
  'a.menuHint': 'Remember to press Save. Untick "In stock" to mark something sold out; customers see it right away.',
  'a.drinks': 'Signature drinks', 'a.teas': 'Teas', 'a.milks': 'Milks', 'a.sizes': 'Sizes', 'a.toppings': 'Toppings',
  'a.onMenu': 'On menu', 'a.inStock': 'In stock', 'a.nameZh': 'Chinese name', 'a.nameEn': 'English name', 'a.shortZh': 'Short (中)', 'a.shortEn': 'Short (EN)',
  'a.priceDrink': 'Price (blank = auto)', 'a.descZh': 'Description (中)', 'a.descEn': 'Description (EN)', 'a.price': 'Price', 'a.priceAuto': 'Auto: {p}', 'a.colorTop': 'Top colour', 'a.colorBottom': 'Bottom colour',
  'a.colorLight': 'Highlight', 'a.colorDark': 'Shadow', 'a.recipe': 'Recipe', 'a.add': '+ Add', 'a.delete': 'Delete',
  'a.save': 'Save menu', 'a.saved': 'Saved. Customers see the new menu now.', 'a.unsaved': 'Unsaved changes', 'a.saveFail': 'Save failed: {e}',
  'a.resetMenu': 'Reset to default', 'a.confirmReset': 'Really reset? All changes are lost', 'a.inUse': 'A signature drink uses this. Change those drinks first.',
  'a.newDrink': 'New drink', 'a.newTea': 'New tea', 'a.newTopping': 'New topping',
  'a.tables': 'Number of tables', 'a.makeQr': 'Make QR codes', 'a.print': 'Print', 'a.qrHint': 'Scanning opens: {url}',
  'a.scan': '扫码点单 · Scan to order',
  'a.tabPromo': 'Promos & stamps', 'a.coupons': 'Promo codes', 'a.loyalty': 'Stamp cards',
  'a.couponHint': 'Customers enter a code at checkout. "Min" is the subtotal needed; leave "Max uses" blank for unlimited and "Expires" blank for no end date.',
  'a.cpCode': 'Code', 'a.cpType': 'Type', 'a.cpAmount': '$ off', 'a.cpPercent': '% off', 'a.cpValue': 'Value', 'a.cpMin': 'Min $',
  'a.cpMax': 'Max uses', 'a.cpExpires': 'Expires', 'a.cpLabelZh': 'Label (中)', 'a.cpLabelEn': 'Label (EN)', 'a.cpActive': 'Active', 'a.cpUses': 'Used {n} times',
  'a.saveCoupons': 'Save codes', 'a.cpSaved': 'Promo codes saved', 'a.newCoupon': 'NEWCODE',
  'a.loyHint': 'Each drink picked up earns 1 stamp; {n} stamps = 1 free drink. Add stamps by hand here for in-store purchases.',
  'a.loyOff': 'Stamp cards are turned off in shop.config.json.', 'a.phonePh': "Customer's phone", 'a.lookup': 'Look up',
  'a.loyStat': '{s} stamps now · {e} earned in total · redeemed {r} times', 'a.addStamp': '+{n}', 'a.removeStamp': '−1', 'a.redeemNow': 'Redeem a drink now (−{n})',
  'a.loyBad': 'Wrong phone number, or not enough stamps', 'a.loyDone': 'Updated',
  'a.badge': 'Badge', 'a.badgeNone': 'None', 'a.caffeine': 'Caffeine', 'a.allergens': 'Allergens',
  'a.oReward': 'Free drink (stamps)', 'a.oCoupon': 'Code {c}', 'a.oDiscount': '−{d}', 'a.oStamps': '+{n} stamp(s)',
});

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byId = (list, id) => (list || []).find(x => String(x.id) === String(id));

let token = null;
let CFG = null;
let MENU = null;
const orders = new Map();
let alertOn = true;
let ws = null;

let toastTimer = null;
function toast(msg) {
  $('toast').textContent = msg;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3000);
}

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
  if (res.status === 401 && path !== 'api/admin/login') { logout(); throw new Error('unauthorized'); }
  if (!res.ok) { const e = new Error(data.error || 'error'); e.code = data.error; throw e; }
  return data;
}

/* =========================================================
   1. 登录
   ========================================================= */
async function boot() {
  I18N.apply();
  try {
    CFG = await api('GET', 'api/config');
  } catch (e) {
    $('loginDemo').hidden = false;
    $('loginForm').querySelector('button').disabled = true;
    return;
  }
  // 后台放在柜台的平板上，用浅色更清楚，不套顾客端的深色主题
  $('loginShop').textContent = CFG.shop.name;
  $('shopName').textContent = CFG.shop.name;
  try { token = sessionStorage.getItem('hitea-staff'); } catch (e) { token = null; }
  if (token) {
    try { await enterApp(); return; } catch (e) { token = null; }
  }
  $('pin').focus();
}

$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('loginError').hidden = true;
  try {
    token = (await api('POST', 'api/admin/login', { pin: $('pin').value })).token;
    try { sessionStorage.setItem('hitea-staff', token); } catch (err) { /* 忽略 */ }
    $('pin').value = '';
    await enterApp();
  } catch (err) {
    $('loginError').textContent = t({ wrong_pin: 'a.wrongPin', too_many_requests: 'a.tooMany', pin_not_configured: 'a.pinMissing' }[err.code] || 'a.wrongPin');
    $('loginError').hidden = false;
  }
});

function logout() {
  token = null;
  try { sessionStorage.removeItem('hitea-staff'); } catch (e) { /* 忽略 */ }
  if (ws) { ws.onclose = null; ws.close(); }
  $('appView').hidden = true;
  $('loginView').hidden = false;
}
$('logoutBtn').addEventListener('click', logout);

async function enterApp() {
  MENU = await api('GET', 'api/admin/menu');
  await loadOrders();
  $('loginView').hidden = true;
  $('appView').hidden = false;
  // 点"登录"这一下也解锁了浏览器的声音，之后新订单可以响铃
  Sound.init();
  Sound.setSfx(alertOn);
  connect();
  renderMenuEditor();
  await loadPromo();
  $('qrHint').textContent = t('a.qrHint', { url: location.origin + '/?table=1' });
}

/* =========================================================
   2. 订单看板
   ========================================================= */
async function loadOrders() {
  const list = await api('GET', 'api/admin/orders');
  orders.clear();
  list.forEach(o => orders.set(o.id, o));
  renderBoard();
}

function connect() {
  const u = new URL('ws', location.href);
  u.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(u);
  ws.onopen = () => ws.send(JSON.stringify({ type: 'staff', token }));
  ws.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'ready') { setLive(true); loadOrders().catch(() => {}); }   // 重连后补上断线期间的订单
    if (msg.type === 'order') onOrder(msg.order);
    if (msg.type === 'menu') api('GET', 'api/admin/menu').then(m => { if (!dirty) { MENU = m; renderMenuEditor(); } });
  };
  ws.onclose = () => { setLive(false); setTimeout(() => token && connect(), 2000); };
}

function setLive(on) {
  $('liveDot').dataset.state = on ? 'on' : 'off';
  $('liveText').textContent = on ? t('a.live') : t('a.offline');
}

const fresh = new Set();
function onOrder(o) {
  if (o.status === 'awaiting_payment') return;      // 还没付钱的在线订单先不显示
  const isNew = !orders.has(o.id) || orders.get(o.id).status === 'awaiting_payment';
  orders.set(o.id, o);
  if (isNew && o.status === 'new') {
    fresh.add(o.id);
    setTimeout(() => { fresh.delete(o.id); renderBoard(); }, 8000);
    if (alertOn) { Sound.chime(); setTimeout(() => Sound.chime(), 700); }
    toast(t('a.newOrder', { n: o.number }));
  }
  renderBoard();
}

const shopTime = iso => new Intl.DateTimeFormat(I18N.lang === 'zh' ? 'zh-CN' : 'en-CA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: CFG.shop.timezone }).format(new Date(iso));

function ago(iso) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? t('a.justNow') : t('a.agoMin', { n: m });
}

function describe(r) {
  return [byId(MENU.sizes, r.size), byId(MENU.teas, r.tea), byId(MENU.milks, r.milk), byId(MENU.sweets, r.sweet), byId(MENU.ices, r.ice), ...r.tops.map(x => byId(MENU.toppings, x))]
    .map(x => (x ? L(x.name) : '?')).join(I18N.lang === 'zh' ? '，' : ', ');
}

const ACTIONS = {
  new: [['making', 'a.start', 'btn'], ['cancelled', 'a.cancel', 'link-btn danger']],
  making: [['ready', 'a.ready', 'btn'], ['cancelled', 'a.cancel', 'link-btn danger']],
  ready: [['done', 'a.picked', 'btn ghost']],
};

function card(o) {
  const when = o.type === 'table' ? t('a.table', { n: o.table })
    : `${t('a.pickup')} · ${!o.pickupAt || o.pickupAt === 'asap' ? t('a.asap') : shopTime(o.pickupAt)}`;
  const due = o.type === 'pickup' && o.pickupAt && o.pickupAt !== 'asap' && o.status !== 'ready' &&
    new Date(o.pickupAt).getTime() - Date.now() < 10 * 60000;
  const items = o.items.map(it =>
    `<li><b>${it.qty} ×</b> ${esc(it.name ? L(it.name) : (I18N.lang === 'zh' ? '特调' : 'Custom'))}<span>${esc(describe(it.recipe))}</span></li>`).join('');
  const btns = (ACTIONS[o.status] || []).map(([to, key, cls]) =>
    `<button class="${cls}" data-id="${o.id}" data-to="${to}">${t(key)}</button>`).join('');
  return `
    <article class="o-card ${fresh.has(o.id) ? 'fresh' : ''} ${due ? 'due' : ''}" data-id="${o.id}">
      <header>
        <span class="o-num">#${esc(o.number)}</span>
        <span class="o-when ${o.type}">${esc(when)}</span>
        <time datetime="${o.createdAt}" class="o-ago">${ago(o.createdAt)}</time>
      </header>
      ${o.name || o.phone ? `<p class="o-who">${esc(o.name)}${o.phone ? ' · ' + esc(o.phone) : ''}</p>` : ''}
      ${due ? `<p class="o-due">${t('a.due')}</p>` : ''}
      <ul class="o-items">${items}</ul>
      ${o.note ? `<p class="o-note">${esc(o.note)}</p>` : ''}
      ${promoTags(o)}
      <footer>
        <span class="o-total">${Pricing.format(o.total)}</span>
        <span class="o-pay ${o.paid ? 'paid' : ''}">${o.paid && o.payment === 'online' ? t('a.paid') : t('a.payStore')}</span>
      </footer>
      <div class="o-actions">${btns}</div>
    </article>`;
}

function promoTags(o) {
  const tags = [];
  if (o.rewardUsed) tags.push(`<span class="o-tag reward">★ ${t('a.oReward')}</span>`);
  if (o.coupon) tags.push(`<span class="o-tag coupon">🏷 ${esc(t('a.oCoupon', { c: o.coupon }))}</span>`);
  if (o.discount) tags.push(`<span class="o-tag">${t('a.oDiscount', { d: Pricing.format(o.discount) })}</span>`);
  if (o.stamps && o.phone) tags.push(`<span class="o-tag stamp">${t('a.oStamps', { n: o.stamps })}${o.stamped ? ' ✓' : ''}</span>`);
  return tags.length ? `<p class="o-tags">${tags.join('')}</p>` : '';
}

function renderBoard() {
  const all = [...orders.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  ['new', 'making', 'ready'].forEach(s => {
    const list = all.filter(o => o.status === s);
    $('col-' + s).innerHTML = list.length ? list.map(card).join('') : `<p class="empty">${t('a.empty')}</p>`;
    $('c-' + s).textContent = list.length || '';
  });
  const newN = all.filter(o => o.status === 'new').length;
  $('newCount').textContent = newN;
  $('newCount').hidden = newN === 0;
  document.title = (newN ? `(${newN}) ` : '') + t('a.title') + ' · ' + CFG.shop.name;
  const done = all.filter(o => ['done', 'cancelled'].includes(o.status)).reverse();
  const doneOk = done.filter(o => o.status === 'done');
  $('doneSummary').textContent = t('a.doneSummary', { n: doneOk.length, total: Pricing.format(doneOk.reduce((s, o) => s + o.total, 0)) });
  $('doneList').innerHTML = done.map(o =>
    `<li class="${o.status}"><b>#${esc(o.number)}</b> ${esc(o.name || (o.type === 'table' ? t('a.table', { n: o.table }) : ''))}
     <span>${shopTime(o.createdAt)}</span> <span>${Pricing.format(o.total)}</span> <span>${t('ord.s.' + o.status)}</span></li>`).join('');
}

// 按钮：推进订单状态。"取消"要点两次，防止手滑
$('tab-orders').addEventListener('click', async e => {
  const b = e.target.closest('button[data-to]');
  if (!b) return;
  if (b.dataset.to === 'cancelled' && !b.dataset.armed) {
    b.dataset.armed = '1';
    b.textContent = t('a.confirmCancel');
    setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = t('a.cancel'); } }, 3000);
    return;
  }
  b.disabled = true;
  try { onOrder(await api('POST', `api/admin/orders/${b.dataset.id}/status`, { status: b.dataset.to })); }
  catch (err) { toast(err.message); b.disabled = false; }
});
setInterval(() => document.querySelectorAll('.o-ago').forEach(el => { el.textContent = ago(el.getAttribute('datetime')); }), 30000);

/* =========================================================
   3. 菜单管理
   在一份"草稿"上修改，点保存才发给服务器
   ========================================================= */
let draft = null;
let dirty = false;

function setDirty(v) {
  dirty = v;
  $('saveState').textContent = v ? t('a.unsaved') : '';
  $('saveBar').classList.toggle('dirty', v);
}

const SECTIONS = [
  { key: 'drinks', title: 'a.drinks', add: 'a.newDrink' },
  { key: 'teas', title: 'a.teas', add: 'a.newTea' },
  { key: 'milks', title: 'a.milks' },
  { key: 'sizes', title: 'a.sizes' },
  { key: 'toppings', title: 'a.toppings', add: 'a.newTopping' },
];

function inp(sec, i, field, value, { type = 'text', label, cls = '', attrs = '' } = {}) {
  const id = `f-${sec}-${i}-${field.replace('.', '-')}`;
  if (type === 'checkbox') {
    return `<label class="chk ${cls}"><input type="checkbox" id="${id}" data-sec="${sec}" data-i="${i}" data-f="${field}" ${value ? 'checked' : ''}> ${t(label)}</label>`;
  }
  return `<label class="ed ${cls}"><span>${t(label)}</span><input class="field" id="${id}" type="${type}" data-sec="${sec}" data-i="${i}" data-f="${field}" value="${esc(value)}" ${attrs}></label>`;
}

const BADGES = ['new', 'limited', 'hot'];
const CAFFEINE = ['none', 'low', 'mid', 'high'];
const ALLERGENS = ['dairy', 'egg', 'soy', 'gluten', 'nuts', 'sesame'];
function optSel(sec, i, field, pairs, value) {
  return `<select class="field" data-sec="${sec}" data-i="${i}" data-f="${field}">${pairs.map(([v, label]) =>
    `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
}

function sel(sec, i, field, list, value) {
  return `<select class="field" data-sec="${sec}" data-i="${i}" data-f="${field}">${list.map(x =>
    `<option value="${esc(x.id)}" ${String(x.id) === String(value) ? 'selected' : ''}>${esc(L(x.name))}</option>`).join('')}</select>`;
}

function rowHtml(sec, x, i) {
  const del = `<button class="link-btn danger" data-del="${sec}" data-i="${i}">${t('a.delete')}</button>`;
  const price = (attrs, label = 'a.price') => inp(sec, i, 'price', x.price ?? '', { type: 'number', label, cls: 'narrow', attrs: 'step="0.05" min="0" max="100" ' + attrs });
  if (sec === 'drinks') {
    const auto = Pricing.format(Pricing.recipeCents(x.preset, { ...draft, drinks: [] }));
    const p = x.preset;
    return `<div class="ed-row drink ${x.active ? '' : 'off'}">
      <div class="ed-line">
        ${inp(sec, i, 'active', x.active, { type: 'checkbox', label: 'a.onMenu' })}
        ${inp(sec, i, 'name.zh', x.name.zh, { label: 'a.nameZh' })}
        ${inp(sec, i, 'name.en', x.name.en, { label: 'a.nameEn' })}
        ${inp(sec, i, 'short.zh', x.short?.zh || '', { label: 'a.shortZh', cls: 'narrow' })}
        ${inp(sec, i, 'short.en', x.short?.en || '', { label: 'a.shortEn', cls: 'narrow' })}
        ${price(`placeholder="${auto}"`, 'a.priceDrink')}
        <label class="ed narrow"><span>${t('a.badge')}</span>${optSel(sec, i, 'badge', [['', t('a.badgeNone')], ...BADGES.map(b => [b, t('badge.' + b)])], x.badge || '')}</label>
        ${del}
      </div>
      <div class="ed-line">
        ${inp(sec, i, 'desc.zh', x.desc?.zh || '', { label: 'a.descZh', cls: 'wide' })}
        ${inp(sec, i, 'desc.en', x.desc?.en || '', { label: 'a.descEn', cls: 'wide' })}
      </div>
      <div class="ed-line recipe"><span class="ed-k">${t('a.recipe')}</span>
        ${sel(sec, i, 'preset.tea', draft.teas, p.tea)} ${sel(sec, i, 'preset.milk', draft.milks, p.milk)}
        ${sel(sec, i, 'preset.sweet', draft.sweets, p.sweet)} ${sel(sec, i, 'preset.ice', draft.ices, p.ice)}
        ${sel(sec, i, 'preset.size', draft.sizes, p.size)}
        <span class="tops">${draft.toppings.map(tp => `<label class="chk"><input type="checkbox" data-sec="drinks" data-i="${i}" data-top="${esc(tp.id)}" ${p.tops.includes(tp.id) ? 'checked' : ''}> ${esc(L(tp.name))}</label>`).join('')}</span>
      </div>
    </div>`;
  }
  const stock = sec === 'sizes' ? '' : inp(sec, i, 'available', x.available !== false, { type: 'checkbox', label: 'a.inStock' });
  const colors = sec === 'teas'
    ? inp(sec, i, 'top', x.top, { type: 'color', label: 'a.colorTop', cls: 'color' }) + inp(sec, i, 'bottom', x.bottom, { type: 'color', label: 'a.colorBottom', cls: 'color' })
    : sec === 'toppings'
      ? inp(sec, i, 'light', x.light, { type: 'color', label: 'a.colorLight', cls: 'color' }) + inp(sec, i, 'dark', x.dark, { type: 'color', label: 'a.colorDark', cls: 'color' })
      : '';
  const swatch = sec === 'teas' ? `<span class="sw" style="background:linear-gradient(${x.top},${x.bottom})"></span>`
    : sec === 'toppings' ? `<span class="sw round" style="background:radial-gradient(circle at 35% 30%,${x.light},${x.dark})"></span>` : '';
  return `<div class="ed-row ${x.available === false ? 'off' : ''}"><div class="ed-line">
    ${swatch}${stock}
    ${inp(sec, i, 'name.zh', x.name.zh, { label: 'a.nameZh' })}
    ${inp(sec, i, 'name.en', x.name.en, { label: 'a.nameEn' })}
    ${price('')}${colors}
    ${sec === 'teas' ? `<label class="ed narrow"><span>${t('a.caffeine')}</span>${optSel(sec, i, 'caffeine', CAFFEINE.map(c => [c, t('caf.' + c)]), x.caffeine || 'mid')}</label>` : ''}
    ${['teas', 'toppings'].includes(sec) ? del : ''}
  </div>
  ${['milks', 'toppings'].includes(sec) ? `<div class="ed-line algs"><span class="ed-k">${t('a.allergens')}</span>${ALLERGENS.map(a =>
    `<label class="chk"><input type="checkbox" data-sec="${sec}" data-i="${i}" data-alg="${a}" ${(x.allergens || []).includes(a) ? 'checked' : ''}> ${t('alg.' + a)}</label>`).join('')}</div>` : ''}
  </div>`;
}

function renderMenuEditor() {
  draft = JSON.parse(JSON.stringify(MENU));
  drawEditor();
  setDirty(false);
}

function drawEditor() {
  $('menuEditor').innerHTML = SECTIONS.map(s => `
    <section class="ed-sec">
      <div class="ed-head"><h2>${t(s.title)}</h2>${s.add ? `<button class="btn btn-sm ghost" data-add="${s.key}">${t('a.add')}</button>` : ''}</div>
      ${draft[s.key].map((x, i) => rowHtml(s.key, x, i)).join('')}
    </section>`).join('');
}

function setPath(obj, path, val) {
  const parts = path.split('.');
  let o = obj;
  for (let k = 0; k < parts.length - 1; k++) { o[parts[k]] = o[parts[k]] || {}; o = o[parts[k]]; }
  o[parts[parts.length - 1]] = val;
}

$('menuEditor').addEventListener('input', e => {
  const el = e.target;
  const sec = el.dataset.sec, i = Number(el.dataset.i);
  if (!sec) return;
  const item = draft[sec][i];
  if (el.dataset.alg) {
    const set = new Set(item.allergens || []);
    if (el.checked) set.add(el.dataset.alg); else set.delete(el.dataset.alg);
    item.allergens = ALLERGENS.filter(a => set.has(a));
  } else if (el.dataset.top) {
    const tops = item.preset.tops;
    if (el.checked) {
      if (tops.length >= 3) { el.checked = false; return toast(t('toast.maxTops', { n: 3 })); }
      tops.push(el.dataset.top);
    } else tops.splice(tops.indexOf(el.dataset.top), 1);
  } else {
    const f = el.dataset.f;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (f === 'price') v = el.value === '' ? (sec === 'drinks' ? null : 0) : Number(el.value);
    if (f === 'preset.sweet') v = Number(v);
    if (f === 'badge') v = v || null;
    setPath(item, f, v);
    if (el.type === 'checkbox' && (f === 'active' || f === 'available')) el.closest('.ed-row').classList.toggle('off', !v);
    if (el.type === 'color') {
      // 只更新色块，不重画整个表单（重画会打断正在拖动的取色器）
      const sw = el.closest('.ed-row').querySelector('.sw');
      if (sw && sec === 'teas') sw.style.background = `linear-gradient(${item.top},${item.bottom})`;
      if (sw && sec === 'toppings') sw.style.background = `radial-gradient(circle at 35% 30%,${item.light},${item.dark})`;
    }
  }
  setDirty(true);
});

// 下拉框、复选框用 change 事件也同步一下（有些浏览器 select 不触发 input）
$('menuEditor').addEventListener('change', e => { if (e.target.tagName === 'SELECT') e.target.dispatchEvent(new Event('input', { bubbles: true })); });

$('menuEditor').addEventListener('click', e => {
  const add = e.target.closest('[data-add]');
  const del = e.target.closest('[data-del]');
  const uid = p => p + '-' + Date.now().toString(36).slice(-6);
  if (add) {
    const sec = add.dataset.add;
    if (sec === 'drinks') draft.drinks.push({ id: uid('drink'), active: false, name: { zh: t('a.newDrink'), en: 'New drink' }, short: { zh: '新饮品', en: 'New' }, desc: { zh: '', en: '' }, preset: { tea: draft.teas[0].id, milk: draft.milks[0].id, sweet: 50, ice: 'normal', size: draft.sizes[0].id, tops: [] }, tags: [], price: null, badge: null });
    if (sec === 'teas') draft.teas.push({ id: uid('tea'), name: { zh: t('a.newTea'), en: 'New tea' }, top: '#D9B48A', bottom: '#8A5A2B', price: 5.5, caffeine: 'mid', available: true });
    if (sec === 'toppings') draft.toppings.push({ id: uid('top'), name: { zh: t('a.newTopping'), en: 'New topping' }, light: '#FFE0E6', dark: '#D46A86', r: 8, count: 12, zone: 'bottom', price: 0.75, allergens: [], available: true });
    drawEditor();
    setDirty(true);
  }
  if (del) {
    const sec = del.dataset.del, i = Number(del.dataset.i);
    const id = draft[sec][i].id;
    const used = sec === 'teas' ? draft.drinks.some(d => d.preset.tea === id) : sec === 'toppings' ? draft.drinks.some(d => d.preset.tops.includes(id)) : false;
    if (used) return toast(t('a.inUse'));
    draft[sec].splice(i, 1);
    drawEditor();
    setDirty(true);
  }
});

$('saveMenuBtn').addEventListener('click', async () => {
  try {
    MENU = await api('PUT', 'api/admin/menu', draft);
    renderMenuEditor();
    toast(t('a.saved'));
  } catch (e) { toast(t('a.saveFail', { e: e.message })); }
});

$('resetMenuBtn').addEventListener('click', async e => {
  const b = e.currentTarget;
  if (!b.dataset.armed) {
    b.dataset.armed = '1';
    b.textContent = t('a.confirmReset');
    setTimeout(() => { delete b.dataset.armed; b.textContent = t('a.resetMenu'); }, 3000);
    return;
  }
  MENU = await api('POST', 'api/admin/menu/reset');
  renderMenuEditor();
  toast(t('a.saved'));
});

/* =========================================================
   5. 优惠码与集点卡
   ========================================================= */
let coupons = [];
let cpDirty = false;
function setCpDirty(v) { cpDirty = v; $('cpState').textContent = v ? t('a.unsaved') : ''; $('cpBar').classList.toggle('dirty', v); }

async function loadPromo() {
  coupons = await api('GET', 'api/admin/coupons');
  drawCoupons();
  setCpDirty(false);
  const L0 = CFG.loyalty;
  $('loyHint').textContent = L0 && L0.enabled ? t('a.loyHint', { n: L0.stampsNeeded }) : t('a.loyOff');
  $('loyForm').hidden = !(L0 && L0.enabled);
}

function drawCoupons() {
  $('cpList').innerHTML = coupons.map((c, i) => {
    const f = (field, value, label, attrs = '', cls = '') =>
      `<label class="ed ${cls}"><span>${t(label)}</span><input class="field" data-cp="${i}" data-f="${field}" value="${esc(value ?? '')}" ${attrs}></label>`;
    return `<div class="ed-row coupon ${c.active === false ? 'off' : ''}">
      <div class="ed-line">
        <label class="chk"><input type="checkbox" data-cp="${i}" data-f="active" ${c.active !== false ? 'checked' : ''}> ${t('a.cpActive')}</label>
        ${f('code', c.code, 'a.cpCode', 'maxlength="20" style="text-transform:uppercase"', 'narrow')}
        <label class="ed narrow"><span>${t('a.cpType')}</span><select class="field" data-cp="${i}" data-f="type">
          <option value="amount" ${c.type === 'amount' ? 'selected' : ''}>${t('a.cpAmount')}</option>
          <option value="percent" ${c.type === 'percent' ? 'selected' : ''}>${t('a.cpPercent')}</option></select></label>
        ${f('value', c.value, 'a.cpValue', 'type="number" min="0" step="0.5"', 'narrow')}
        ${f('minSubtotal', c.minSubtotal || '', 'a.cpMin', 'type="number" min="0" step="1"', 'narrow')}
        ${f('maxUses', c.maxUses ?? '', 'a.cpMax', 'type="number" min="1" step="1"', 'narrow')}
        ${f('expires', c.expires || '', 'a.cpExpires', 'type="date"', 'narrow')}
        <button class="link-btn danger" data-cpdel="${i}">${t('a.delete')}</button>
      </div>
      <div class="ed-line">
        ${f('label.zh', c.label?.zh, 'a.cpLabelZh', 'maxlength="40"', 'wide')}
        ${f('label.en', c.label?.en, 'a.cpLabelEn', 'maxlength="60"', 'wide')}
        <span class="cp-uses">${t('a.cpUses', { n: c.uses || 0 })}${c.maxUses ? ' / ' + c.maxUses : ''}</span>
      </div>
    </div>`;
  }).join('') || `<p class="empty">${t('a.empty')}</p>`;
}

$('cpList').addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.cp === undefined) return;
  const c = coupons[Number(el.dataset.cp)];
  const f = el.dataset.f;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (f === 'code') v = v.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (['value', 'minSubtotal'].includes(f)) v = v === '' ? 0 : Number(v);
  if (f === 'maxUses') v = v === '' ? null : Number(v);
  if (f === 'expires') v = v || null;
  setPath(c, f, v);
  if (f === 'active') el.closest('.ed-row').classList.toggle('off', !v);
  setCpDirty(true);
});
$('cpList').addEventListener('change', e => { if (e.target.tagName === 'SELECT') e.target.dispatchEvent(new Event('input', { bubbles: true })); });
$('cpList').addEventListener('click', e => {
  const d = e.target.closest('[data-cpdel]');
  if (!d) return;
  coupons.splice(Number(d.dataset.cpdel), 1);
  drawCoupons();
  setCpDirty(true);
});
$('cpAdd').addEventListener('click', () => {
  coupons.push({ code: t('a.newCoupon') + (coupons.length + 1), type: 'amount', value: 1, minSubtotal: 0, active: false, maxUses: null, expires: null, label: { zh: '', en: '' }, uses: 0 });
  drawCoupons();
  setCpDirty(true);
});
$('cpSave').addEventListener('click', async () => {
  try {
    coupons = await api('PUT', 'api/admin/coupons', coupons);
    drawCoupons();
    setCpDirty(false);
    toast(t('a.cpSaved'));
  } catch (e) { toast(t('a.saveFail', { e: e.message })); }
});

function drawLoyalty(c) {
  const n = c.needed || 10;
  const box = $('loyResult');
  const dots = Array.from({ length: n }, (_, k) => `<span class="stamp ${k < Math.min(c.stamps, n) ? 'on' : ''}">${k < c.stamps ? '★' : ''}</span>`).join('');
  box.innerHTML = `<p class="loy-phone">${esc(c.phone)}</p>
    <div class="stamps">${dots}</div>
    <p class="hint">${t('a.loyStat', { s: c.stamps, e: c.earned, r: c.redeemed })}</p>
    <div class="loy-btns">
      <button class="btn btn-sm ghost" data-delta="1">${t('a.addStamp', { n: 1 })}</button>
      <button class="btn btn-sm ghost" data-delta="5">${t('a.addStamp', { n: 5 })}</button>
      <button class="btn btn-sm ghost" data-delta="-1" ${c.stamps < 1 ? 'disabled' : ''}>${t('a.removeStamp')}</button>
      <button class="btn btn-sm" data-delta="${-n}" ${c.stamps < n ? 'disabled' : ''}>${t('a.redeemNow', { n })}</button>
    </div>`;
  box.hidden = false;
}
$('loyForm').addEventListener('submit', async e => {
  e.preventDefault();
  try { drawLoyalty(await api('GET', 'api/admin/loyalty?phone=' + encodeURIComponent($('loyPhone').value))); }
  catch (err) { toast(t('a.loyBad')); }
});
$('loyResult').addEventListener('click', async e => {
  const b = e.target.closest('[data-delta]');
  if (!b) return;
  try {
    drawLoyalty(await api('POST', 'api/admin/loyalty', { phone: $('loyPhone').value, delta: Number(b.dataset.delta) }));
    toast(t('a.loyDone'));
  } catch (err) { toast(t('a.loyBad')); }
});

/* =========================================================
   4. 桌号二维码
   ========================================================= */
$('qrMake').addEventListener('click', async () => {
  const n = Math.max(1, Math.min(60, Number($('qrCount').value) || 1));
  $('qrGrid').innerHTML = '';
  for (let i = 1; i <= n; i++) {
    const svg = await api('GET', `api/admin/qr?table=${i}`);
    const div = document.createElement('div');
    div.className = 'qr-card';
    div.innerHTML = `<p class="qr-shop display">${esc(CFG.shop.name)}</p>${svg}<p class="qr-table">${esc(t('a.table', { n: i }))}</p><p class="qr-scan">${esc(t('a.scan'))}</p>`;
    $('qrGrid').appendChild(div);
  }
});
$('qrPrint').addEventListener('click', () => window.print());

/* =========================================================
   切换标签页、语言、提醒
   ========================================================= */
document.querySelectorAll('.a-tabs [role=tab]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.a-tabs [role=tab]').forEach(x => x.setAttribute('aria-selected', x === b));
  ['orders', 'menu', 'promo', 'qr'].forEach(k => { $('tab-' + k).hidden = k !== b.dataset.tab; });
}));
$('alertBtn').addEventListener('click', () => {
  alertOn = !alertOn;
  Sound.setSfx(alertOn);
  $('alertBtn').setAttribute('aria-pressed', alertOn);
  if (alertOn) Sound.chime();
});
$('aLangBtn').addEventListener('click', () => {
  I18N.set(I18N.lang === 'zh' ? 'en' : 'zh');
  renderBoard();
  if (!dirty) renderMenuEditor(); else drawEditor();
  drawCoupons();
  if (!$('loyResult').hidden && $('loyPhone').value) $('loyForm').requestSubmit();
  setLive($('liveDot').dataset.state === 'on');
  $('qrHint').textContent = t('a.qrHint', { url: location.origin + '/?table=1' });
});
window.addEventListener('beforeunload', e => { if (dirty || cpDirty) { e.preventDefault(); e.returnValue = ''; } });

boot();
