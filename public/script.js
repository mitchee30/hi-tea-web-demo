/* =========================================================
   script.js：顾客端页面逻辑
   1. 全局状态和工具函数
   2. 路由（# 后面的网址决定显示哪一页）
   3. 自己调一杯
   4. 首页、招牌菜单
   5. 今天喝什么（转盘）
   6. 购物车
   7. 结账
   8. 订单状态（实时更新）
   9. 语言、声音、菜单实时更新、启动
   ========================================================= */

/* =========================================================
   1. 全局状态和工具函数
   ========================================================= */
const $ = id => document.getElementById(id);
const byId = (list, id) => (list || []).find(x => String(x.id) === String(id));
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let CFG = null;        // 店铺配置（从服务器或 shop.config.json 读来）
let MENU = null;       // 菜单（店员后台改了会实时更新）
let recipe = null;     // 正在调的那一杯
let cart = [];         // 购物车：[{ drinkId, recipe, qty }]
let table = null;      // 扫桌上二维码进来时的桌号

const money = c => Pricing.format(c, CFG.shop.currency);
const maxTops = () => CFG.features.maxToppings || 3;
const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
  set(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* 存不了就算了 */ } },
};

function defaultRecipe() {
  const pick = (list, pref) => (byId(list, pref) && byId(list, pref).available !== false ? pref : (list.find(x => x.available !== false) || list[0]).id);
  return { tea: pick(MENU.teas, 'black'), milk: pick(MENU.milks, 'milk'), sweet: 50, ice: 'normal', size: MENU.sizes[0].id, tops: [] };
}

function describe(r) {
  return [
    L(byId(MENU.sizes, r.size)?.name), L(byId(MENU.teas, r.tea)?.name), L(byId(MENU.milks, r.milk)?.name),
    L(byId(MENU.sweets, r.sweet)?.name), L(byId(MENU.ices, r.ice)?.name),
    ...r.tops.map(tp => L(byId(MENU.toppings, tp)?.name)),
  ].filter(Boolean).join(I18N.lang === 'zh' ? '，' : ', ');
}

const recipeOk = r => Pricing.checkRecipe(r, MENU, maxTops()).ok;
const unitCents = (r, drinkId) => Pricing.recipeCents(r, MENU, drinkId);

// 这一杯是不是正好等于某个招牌
function matchDrink(r, drinkId) {
  const d = drinkId ? byId(MENU.drinks, drinkId) : MENU.drinks.find(x => x.active && Pricing.sameRecipe(x.preset, r));
  return d && d.active && Pricing.sameRecipe(d.preset, r) ? d : null;
}
const drinkName = (r, drinkId) => { const d = matchDrink(r, drinkId); return d ? L(d.name) : t('custom'); };

// 配方 ⇄ 网址参数（比如 tea=taro&milk=milk&sweet=50&ice=less&size=M&tops=pearl,taroball）
function toQuery(r) {
  const q = new URLSearchParams({ tea: r.tea, milk: r.milk, sweet: r.sweet, ice: r.ice, size: r.size });
  if (r.tops.length) q.set('tops', r.tops.join(','));
  return q.toString();
}
function fromQuery(qs) {
  const q = new URLSearchParams(qs);
  const d = defaultRecipe();
  const pick = (list, key, fb) => { const v = q.get(key); return v !== null && byId(list, v) ? byId(list, v).id : fb; };
  const tops = (q.get('tops') || '').split(',').filter(tp => byId(MENU.toppings, tp));
  return {
    tea: pick(MENU.teas, 'tea', d.tea), milk: pick(MENU.milks, 'milk', d.milk), sweet: pick(MENU.sweets, 'sweet', d.sweet),
    ice: pick(MENU.ices, 'ice', d.ice), size: pick(MENU.sizes, 'size', d.size), tops: [...new Set(tops)].slice(0, maxTops()),
  };
}

let toastTimer = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

/* =========================================================
   2. 路由
   #/  #/diy?配方  #/menu  #/wheel  #/checkout  #/order?id=..&token=..
   只有 # 后面变化，浏览器不会重新加载，所以背景音乐不会断。
   ========================================================= */
const ROUTES = {
  home: 'view-home', diy: 'view-diy', menu: 'view-menu', wheel: 'view-wheel', checkout: 'view-checkout', order: 'view-order',
};
let currentRoute = null;
let firstRoute = true;

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  let name = ROUTES[path] ? path : 'home';
  if (name === 'wheel' && !CFG.features.wheel) name = 'home';
  return { name, query };
}

function router() {
  const { name, query } = parseHash();
  const leaving = currentRoute;
  currentRoute = name;
  Object.entries(ROUTES).forEach(([key, id]) => { $(id).hidden = key !== name; });
  document.querySelectorAll('.tabs a').forEach(a => {
    if (a.dataset.route === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.body.dataset.route = name;
  updateTitle();

  if (leaving === 'order' && name !== 'order') stopOrderPolling();
  if (name === 'diy') enterDiy(query);
  if (name === 'wheel') enterWheel();
  if (name === 'checkout') enterCheckout();
  if (name === 'order') enterOrder(query);
  if ($('cartDialog').open) $('cartDialog').close();

  // 换页后回到顶部，并把焦点放到标题上（用键盘和读屏软件的人才知道换页了）
  if (!firstRoute) {
    window.scrollTo(0, 0);
    const h = $(ROUTES[name]).querySelector('h1');
    if (h) h.focus({ preventScroll: true });
  }
  firstRoute = false;
}
window.addEventListener('hashchange', router);

function updateTitle() {
  const names = { home: '', diy: t('diy.title'), menu: t('menu.title'), wheel: t('wheel.title'), checkout: t('co.title'), order: t('ord.title') };
  const n = names[currentRoute];
  document.title = n ? `${n} · ${CFG.shop.name}` : CFG.shop.name;
}

/* =========================================================
   3. 自己调一杯
   ========================================================= */
let diyCup = null;

function makeChips(boxId, items, isOn, onPick, { showPrice = false, swatch = null, soldOut = () => false } = {}) {
  const box = $(boxId);
  box.innerHTML = '';
  items.forEach(item => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.id = item.id;
    const out = soldOut(item);
    if (swatch) b.insertAdjacentHTML('beforeend', `<span class="dot" style="background:${swatch(item)}"></span>`);
    b.insertAdjacentHTML('beforeend', `<span>${esc(L(item.name))}</span>`);
    if (out) { b.disabled = true; b.classList.add('sold-out'); b.insertAdjacentHTML('beforeend', `<span class="extra">${t('soldout')}</span>`); }
    else if (showPrice && item.price) b.insertAdjacentHTML('beforeend', `<span class="extra">+${money(Pricing.cents(item.price))}</span>`);
    b.setAttribute('aria-pressed', isOn(item));
    b.addEventListener('click', () => onPick(item));
    box.appendChild(b);
  });
}

function buildChips() {
  const out = x => x.available === false;
  makeChips('opt-tea', MENU.teas, x => recipe.tea === x.id, x => setRecipe({ tea: x.id }),
    { swatch: x => `linear-gradient(${x.top}, ${x.bottom})`, soldOut: out });
  makeChips('opt-milk', MENU.milks, x => recipe.milk === x.id, x => setRecipe({ milk: x.id }), { showPrice: true, soldOut: out });
  makeChips('opt-sweet', MENU.sweets, x => recipe.sweet === x.id, x => setRecipe({ sweet: x.id }));
  makeChips('opt-ice', MENU.ices, x => recipe.ice === x.id, x => setRecipe({ ice: x.id }));
  makeChips('opt-size', MENU.sizes, x => recipe.size === x.id, x => setRecipe({ size: x.id }), { showPrice: true });
  makeChips('opt-top', MENU.toppings, x => recipe.tops.includes(x.id), x => {
    const list = [...recipe.tops];
    const i = list.indexOf(x.id);
    if (i >= 0) list.splice(i, 1);
    else if (list.length < maxTops()) list.push(x.id);
    else return toast(t('toast.maxTops', { n: maxTops() }));
    setRecipe({ tops: list });
  }, { showPrice: true, soldOut: out, swatch: x => `radial-gradient(circle at 35% 30%, ${x.light}, ${x.dark})` });
  $('topsMax').textContent = t('step.topsMax', { n: maxTops() });
}

function setRecipe(patch, { sound = true } = {}) {
  const prev = recipe;
  recipe = { ...recipe, ...patch, tops: patch.tops ? [...patch.tops] : [...recipe.tops] };
  if (sound) {
    if ((patch.tea && patch.tea !== prev.tea) || (patch.milk && patch.milk !== prev.milk)) Sound.pour();
    const cubes = id => (byId(MENU.ices, id) || { cubes: 0 }).cubes;
    if (patch.ice && cubes(patch.ice) > cubes(prev.ice)) Sound.clink();
  }
  renderDiy();
  // 把当前配方写进网址：复制网址就能分享这一杯。replaceState 不会触发 hashchange
  history.replaceState(null, '', '#/diy?' + toQuery(recipe));
}

function renderDiy() {
  document.querySelectorAll('#view-diy .chip').forEach(b => {
    const box = b.parentElement.id, id = b.dataset.id;
    const on = box === 'opt-top' ? recipe.tops.includes(id) : String(recipe[{ 'opt-tea': 'tea', 'opt-milk': 'milk', 'opt-sweet': 'sweet', 'opt-ice': 'ice', 'opt-size': 'size' }[box]]) === id;
    b.setAttribute('aria-pressed', on);
  });
  diyCup.update(recipe);
  $('summary').textContent = describe(recipe);
  $('price').textContent = money(unitCents(recipe, matchDrink(recipe)?.id));
  const ok = recipeOk(recipe);
  $('addDiyBtn').disabled = !ok;
  $('addDiyBtn').textContent = ok ? t('diy.add') : t('soldout');
  diyCup.svg.setAttribute('aria-label', describe(recipe));
}

function enterDiy(query) {
  if (query) recipe = fromQuery(query);
  renderDiy();
}

function setupDiy() {
  diyCup = Cup.create($('diyCup'), { size: 'lg', onLand: () => Sound.plop() });
  $('addDiyBtn').addEventListener('click', () => addToCart(recipe, matchDrink(recipe)?.id));
  $('resetBtn').addEventListener('click', () => setRecipe(defaultRecipe(), { sound: false }));
  $('shareBtn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); toast(t('toast.copied')); }
    catch (e) { toast(t('toast.copyFail')); }
  });
}

/* =========================================================
   4. 首页、招牌菜单
   ========================================================= */
const activeDrinks = () => MENU.drinks.filter(d => d.active);

function buildMenuGrid() {
  const grid = $('menuGrid');
  grid.innerHTML = '';
  activeDrinks().forEach((d, i) => {
    const ok = recipeOk(d.preset);
    const li = document.createElement('li');
    li.className = 'menu-card' + (ok ? '' : ' is-soldout');
    li.innerHTML = `
      <div class="menu-cup"></div>
      <div class="menu-body">
        <h2>${esc(L(d.name))}</h2>
        <p class="en">${esc(I18N.lang === 'zh' ? d.name.en : d.name.zh)}</p>
        <p class="desc">${esc(L(d.desc))}</p>
        <div class="menu-foot">
          <span class="price-sm">${money(unitCents(d.preset, d.id))}</span>
          ${ok ? `<a class="link-btn" href="#/diy?${toQuery(d.preset)}">${t('menu.custom')}</a>` : ''}
          <button class="btn btn-sm" ${ok ? '' : 'disabled'}>${ok ? t('menu.add') : t('soldoutToday')}</button>
        </div>
      </div>`;
    const cup = Cup.create(li.querySelector('.menu-cup'), { size: 'sm', seed: 101 + i });
    cup.update(d.preset);
    cup.svg.setAttribute('aria-label', L(d.name));
    li.querySelector('button').addEventListener('click', () => addToCart(d.preset, d.id));
    grid.appendChild(li);
  });
}

function buildHome() {
  $('home-title').textContent = L(CFG.shop.tagline);
  $('homeCup').innerHTML = '';
  $('homeMenuCups').innerHTML = '';
  const ds = activeDrinks();
  if (!ds.length) return;
  const hc = Cup.create($('homeCup'), { size: 'sm', seed: 7 });
  hc.update((ds.find(d => d.id === 'taro') || ds[0]).preset);
  hc.svg.setAttribute('aria-hidden', 'true');
  [0, 3, 4].map(i => ds[i % ds.length]).forEach((d, k) => {
    const c = Cup.create($('homeMenuCups'), { size: 'sm', seed: 31 + k });
    c.update(d.preset);
    c.svg.setAttribute('aria-hidden', 'true');
  });
  const hw = $('homeWheel');
  hw.innerHTML = '';
  drawWheel(hw, true);
}

/* =========================================================
   5. 今天喝什么（转盘）
   ========================================================= */
const mood = { current: 'any' };
const weather = { kind: 'mild', temp: null, loaded: false, failed: false };
const SEG_COLORS = ['#9B7FC4', '#F2A7B8', '#9A5A26', '#C9B8DD', '#6E9A5B', '#F7D5DC', '#2B1D3F', '#E0823A'];
const DARK_SEGS = ['#9A5A26', '#6E9A5B', '#2B1D3F', '#9B7FC4', '#E0823A'];
let wheelDrinks = [];

/* 画转盘：文字沿半径方向；左半边的字转 180°，每一格都能正着读 */
function drawWheel(target, mini) {
  const g = mini ? target : target.querySelector('#wheel-rot');
  g.innerHTML = '';
  wheelDrinks = activeDrinks().filter(d => recipeOk(d.preset));
  const n = Math.max(wheelDrinks.length, 1);
  const seg = 360 / n;
  const cx = 200, cy = 200, r = 190;
  wheelDrinks.forEach((d, i) => {
    const a0 = (i * seg - 90) * Math.PI / 180, a1 = ((i + 1) * seg - 90) * Math.PI / 180;
    const color = SEG_COLORS[i % SEG_COLORS.length];
    const large = seg > 180 ? 1 : 0;
    svgEl('path', {
      d: n === 1 ? `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`
        : `M${cx} ${cy} L${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} Z`,
      fill: color, stroke: '#fff', 'stroke-width': 4,
    }, g);
    if (mini) return;
    const mid = i * seg + seg / 2;
    const rad = (mid - 90) * Math.PI / 180;
    const tx = cx + 122 * Math.cos(rad), ty = cy + 122 * Math.sin(rad);
    const flip = mid > 180;
    const text = svgEl('text', {
      x: tx, y: ty, 'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-family': 'ZCOOL KuaiLe, sans-serif', 'font-size': I18N.lang === 'en' ? 19 : 23,
      fill: DARK_SEGS.includes(color) ? '#fff' : '#2B1D3F',
      transform: `rotate(${flip ? mid + 90 : mid - 90} ${tx} ${ty})`,
    }, g);
    text.textContent = L(d.short || d.name);
  });
  svgEl('circle', { cx, cy, r: mini ? 34 : 30, fill: '#fff' }, g);
  if (!mini) svgEl('circle', { cx, cy, r: 12, fill: CFG.theme.ink }, g);
}

async function loadWeather() {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 5000);
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${CFG.shop.lat}&longitude=${CFG.shop.lon}&current=temperature_2m,precipitation,weather_code`;
    const data = await (await fetch(u, { signal: ctrl.signal })).json();
    const tC = Math.round(data.current.temperature_2m);
    const code = data.current.weather_code;
    const raining = data.current.precipitation > 0 || (code >= 51 && code <= 82);
    weather.temp = tC;
    weather.kind = raining ? 'rain' : tC < 10 ? 'cold' : tC >= 24 ? 'hot' : 'mild';
  } catch (e) { weather.failed = true; }
  renderWeather();
}

function renderWeather() {
  const el = $('weather');
  const city = L(CFG.shop.city);
  if (!weather.loaded) { el.textContent = t('weather.loading', { city }); return; }
  if (weather.temp === null && !weather.failed) { el.textContent = t('weather.loading', { city }); return; }
  el.textContent = weather.failed ? t('weather.fail') : t('weather.now', { city, t: weather.temp, kind: t('weather.' + weather.kind) });
  const sel = document.createElement('select');
  sel.setAttribute('aria-label', t('wheel.title'));
  ['cold', 'mild', 'hot', 'rain'].forEach(k => sel.add(new Option(t('weather.' + k), k, false, k === weather.kind)));
  sel.addEventListener('change', e => { weather.kind = e.target.value; });
  el.appendChild(sel);
}

function enterWheel() {
  if (!weather.loaded) { weather.loaded = true; renderWeather(); loadWeather(); }
}

function scoreDrink(d) {
  let s = Math.random() * 1.5;
  const tags = d.tags || [];
  if (weather.kind === 'cold' || weather.kind === 'rain') { if (tags.includes('warmok')) s += 3; if (tags.includes('cozy')) s += 2; }
  if (weather.kind === 'hot') { if (tags.includes('fruity')) s += 3; if (tags.includes('fresh')) s += 2; }
  if (mood.current === 'wake' && tags.includes('caffeine')) s += 3;
  if (mood.current === 'sweet' && tags.includes('sweet')) s += 3;
  if (mood.current === 'fresh' && (tags.includes('fresh') || tags.includes('fruity'))) s += 3;
  if (mood.current === 'any') s += Math.random() * 3;
  return s;
}

let wheelAngle = 0;
let picked = null;

/* 转盘动画用 JavaScript 一帧一帧算角度，这样才知道指针指到哪一格，每过一格"嗒"一声 */
function spin() {
  if (!wheelDrinks.length) return;
  const seg = 360 / wheelDrinks.length;
  const ranked = wheelDrinks.map((d, i) => ({ d, i, s: scoreDrink(d) })).sort((a, b) => b.s - a.s);
  const { d, i } = ranked[0];
  const hotOk = byId(MENU.ices, 'hot');
  const makeHot = !!hotOk && (weather.kind === 'cold' || weather.kind === 'rain') && (d.tags || []).includes('warmok');
  picked = { drink: d, recipe: { ...d.preset, tops: [...d.preset.tops], ice: makeHot ? 'hot' : d.preset.ice }, makeHot };

  const target = 360 - (i * seg + seg / 2);
  const current = ((wheelAngle % 360) + 360) % 360;
  const from = wheelAngle;
  const to = wheelAngle + 360 * 5 + ((target - current + 360) % 360);
  const dur = reduceMotion() ? 1 : 4200;
  const g = $('wheel-rot');
  $('spinBtn').disabled = true;
  $('result').hidden = true;
  const start = performance.now();
  let lastSeg = null;
  const easeOut = x => 1 - Math.pow(1 - x, 4);
  (function frame(now) {
    const p = Math.min(1, (now - start) / dur);
    wheelAngle = from + (to - from) * easeOut(p);
    g.setAttribute('transform', `rotate(${wheelAngle} 200 200)`);
    const s = Math.floor((((360 - wheelAngle) % 360) + 360) % 360 / seg);
    if (s !== lastSeg) { if (lastSeg !== null) Sound.tick(); lastSeg = s; }
    if (p < 1) requestAnimationFrame(frame); else showResult();
  })(start);
}

function showResult() {
  if (!picked) return;
  const d = picked.drink;
  $('resultName').textContent = L(d.name);
  $('resultWhy').textContent = t('why.' + weather.kind) + t('why.' + mood.current) + (picked.makeHot ? t('why.madeHot') : '');
  $('resultCup').innerHTML = '';
  const c = Cup.create($('resultCup'), { size: 'sm', seed: 55 });
  c.update(picked.recipe);
  c.svg.setAttribute('aria-hidden', 'true');
  $('result').hidden = false;
  $('spinBtn').disabled = false;
  $('spinBtn').textContent = t('wheel.again');
  Sound.chime();
}

function buildMoodChips() {
  const moods = ['wake', 'sweet', 'fresh', 'any'].map(id => ({ id, name: { zh: I18N.t('mood.' + id), en: I18N.t('mood.' + id) } }));
  makeChips('opt-mood', moods, x => mood.current === x.id, x => {
    mood.current = x.id;
    document.querySelectorAll('#opt-mood .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.id === x.id));
  });
}

function setupWheel() {
  $('spinBtn').addEventListener('click', spin);
  $('resultAdd').addEventListener('click', () => picked && addToCart(picked.recipe, picked.drink.id));
  $('resultDiy').addEventListener('click', () => { if (picked) location.hash = '#/diy?' + toQuery(picked.recipe); });
}

/* =========================================================
   6. 购物车（存在 localStorage，刷新不会丢）
   ========================================================= */
function loadCart() {
  cart = store.get('hitea-cart-v2', []).filter(l => l && l.recipe && Number.isInteger(l.qty)).map(l => ({
    drinkId: l.drinkId || null, recipe: fromQuery(toQuery(l.recipe)), qty: Math.max(1, Math.min(20, l.qty)),
  }));
}
const saveCart = () => store.set('hitea-cart-v2', cart);
const cartCount = () => cart.reduce((s, l) => s + l.qty, 0);

function addToCart(r, drinkId) {
  if (!recipeOk(r)) return toast(t('soldout'));
  const line = { drinkId: matchDrink(r, drinkId) ? drinkId || matchDrink(r).id : null, recipe: { ...r, tops: [...r.tops] }, qty: 1 };
  const same = cart.find(l => l.drinkId === line.drinkId && Pricing.sameRecipe(l.recipe, line.recipe));
  if (same) same.qty = Math.min(20, same.qty + 1); else cart.push(line);
  saveCart();
  renderCart();
  Sound.chime();
  toast(t('cart.added', { name: drinkName(line.recipe, line.drinkId) }));
  if (!reduceMotion()) $('cartBtn').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 350 });
}

function renderCart() {
  const n = cartCount();
  $('cartCount').textContent = n;
  $('cartCount').hidden = n === 0;
  $('cartBtn').setAttribute('aria-label', t('cart.count', { n }));
  const list = $('cartList');
  list.innerHTML = '';
  cart.forEach((l, idx) => {
    const li = document.createElement('li');
    li.className = 'cart-item';
    li.innerHTML = `
      <div class="cart-info"><strong>${esc(drinkName(l.recipe, l.drinkId))}</strong><span>${esc(describe(l.recipe))}</span></div>
      <div class="qty">
        <button class="icon-btn" aria-label="${t('cart.less')}">−</button><span>${l.qty}</span>
        <button class="icon-btn" aria-label="${t('cart.more')}">+</button>
      </div>
      <span class="cart-price">${money(unitCents(l.recipe, l.drinkId) * l.qty)}</span>`;
    const [minus, plus] = li.querySelectorAll('button');
    minus.addEventListener('click', () => { l.qty--; if (l.qty <= 0) cart.splice(idx, 1); saveCart(); renderCart(); if (currentRoute === 'checkout') renderCheckout(); });
    plus.addEventListener('click', () => { l.qty = Math.min(20, l.qty + 1); saveCart(); renderCart(); if (currentRoute === 'checkout') renderCheckout(); });
    list.appendChild(li);
  });
  $('cartTotal').textContent = money(Pricing.totals(cart, MENU, 0).subtotal);
  $('cartEmpty').hidden = cart.length > 0;
  $('cartFoot').hidden = cart.length === 0;
}

function setupCart() {
  loadCart();
  $('cartBtn').addEventListener('click', () => { renderCart(); $('cartDialog').showModal(); });
  $('cartClose').addEventListener('click', () => $('cartDialog').close());
  $('cartDialog').addEventListener('click', e => { if (e.target === $('cartDialog')) $('cartDialog').close(); });
}

/* =========================================================
   7. 结账
   ========================================================= */
const co = { how: 'pickup', pay: 'store', slots: null, submitting: false };

function radioGroup(boxId, name, options, value, onChange) {
  const box = $(boxId);
  box.innerHTML = '';
  options.forEach(o => {
    const lab = document.createElement('label');
    lab.className = 'seg-opt';
    lab.innerHTML = `<input type="radio" name="${name}" value="${o.value}" ${o.value === value ? 'checked' : ''}><span>${esc(o.label)}</span>`;
    lab.querySelector('input').addEventListener('change', () => onChange(o.value));
    box.appendChild(lab);
  });
}

async function enterCheckout() {
  const saved = store.get('hitea-customer', {});
  if (!$('coName').value && saved.name) $('coName').value = saved.name;
  if (!$('coPhone').value && saved.phone) $('coPhone').value = saved.phone;
  co.how = table ? 'table' : 'pickup';
  $('coError').hidden = true;
  renderCheckout();
  try { co.slots = await Api.slots(); } catch (e) { co.slots = { open: false, slots: [] }; }
  renderCheckout();
}

function shopTime(iso) {
  return new Intl.DateTimeFormat(I18N.lang === 'zh' ? 'zh-CN' : 'en-CA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: CFG.shop.timezone }).format(new Date(iso));
}

function renderCheckout() {
  const empty = cart.length === 0;
  $('coEmpty').hidden = !empty;
  $('coForm').hidden = empty;
  $('coDemo').hidden = Api.mode !== 'demo';
  if (empty) return;

  // 怎么取：扫桌上二维码进来的可以选堂食
  $('coHowBlock').hidden = !table;
  if (table) {
    radioGroup('coHow', 'how', [{ value: 'table', label: t('co.table', { n: table }) }, { value: 'pickup', label: t('co.pickup') }], co.how,
      v => { co.how = v; renderCheckout(); });
  }
  $('coTimeBlock').hidden = co.how === 'table';

  // 取餐时间
  const sel = $('coTime');
  const prev = sel.value;
  sel.innerHTML = '';
  const s = co.slots;
  if (s) {
    if (s.open) sel.add(new Option(t('co.asap', { n: CFG.hours.prepMinutes || 10 }), 'asap'));
    s.slots.forEach(iso => sel.add(new Option(shopTime(iso), iso)));
    if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
  }
  const closed = s && !s.open && (co.how === 'table' || s.slots.length === 0);
  $('coClosed').hidden = !closed;
  $('coClosed').textContent = t('co.closed', { open: CFG.hours.open, close: CFG.hours.close });

  // 付款方式
  const payOpts = [{ value: 'store', label: t('co.payStore') }];
  if (CFG.payments.online) payOpts.push({ value: 'online', label: t('co.payOnline') });
  if (!payOpts.some(o => o.value === co.pay)) co.pay = 'store';
  radioGroup('coPay', 'pay', payOpts, co.pay, v => { co.pay = v; renderCheckout(); });
  $('coPayHint').hidden = co.pay !== 'online';

  // 你点的 + 金额
  $('coItems').innerHTML = cart.map(l => `
    <li><div><strong>${esc(drinkName(l.recipe, l.drinkId))}</strong> × ${l.qty}<span>${esc(describe(l.recipe))}</span></div>
    <b>${money(unitCents(l.recipe, l.drinkId) * l.qty)}</b></li>`).join('');
  const tot = Pricing.totals(cart, MENU, CFG.shop.taxRate);
  $('coSub').textContent = money(tot.subtotal);
  $('coTaxLabel').textContent = t('co.tax', { name: CFG.shop.taxName });
  $('coTax').textContent = money(tot.tax);
  $('coTotal').textContent = money(tot.total);
  $('coSubmit').textContent = co.submitting ? t('co.submitting') : t('co.submit', { total: money(tot.total) });
  $('coSubmit').disabled = co.submitting || !s || closed || !cart.every(l => recipeOk(l.recipe));
}

function showCoError(code) {
  const el = $('coError');
  el.textContent = t('err.' + code) !== 'err.' + code ? t('err.' + code) : t('err.generic');
  el.hidden = false;
}

async function submitOrder(e) {
  e.preventDefault();
  if (co.submitting) return;
  const name = $('coName').value.trim();
  if (co.how === 'pickup' && !name) { showCoError('name_required'); $('coName').focus(); return; }
  co.submitting = true;
  $('coError').hidden = true;
  renderCheckout();
  const body = {
    lines: cart.map(l => ({ drinkId: l.drinkId, recipe: l.recipe, qty: l.qty })),
    type: co.how, table: co.how === 'table' ? table : undefined,
    pickupAt: co.how === 'pickup' ? $('coTime').value : undefined,
    name, phone: $('coPhone').value.trim(), note: $('coNote').value.trim(),
    payment: co.pay, lang: I18N.lang,
  };
  try {
    const res = await Api.createOrder(body, MENU);
    store.set('hitea-customer', { name, phone: body.phone });
    const mine = store.get('hitea-my-orders', []);
    mine.unshift({ id: res.id, token: res.token, number: res.number, at: Date.now() });
    store.set('hitea-my-orders', mine.slice(0, 10));
    cart = [];
    saveCart();
    renderCart();
    $('coNote').value = '';
    co.submitting = false;
    updateOrderChip();
    if (res.paymentFallback) toast(t('err.payment'));
    if (res.checkoutUrl) { location.href = res.checkoutUrl; return; }   // 跳到 Stripe 付款页面
    Sound.chime();
    location.hash = `#/order?id=${encodeURIComponent(res.id)}&token=${encodeURIComponent(res.token)}`;
  } catch (err) {
    co.submitting = false;
    showCoError(err.code || 'generic');
    if (err.code === 'sold_out') await refreshMenu();
    if (err.code === 'bad_pickup_time') { co.slots = await Api.slots().catch(() => co.slots); }
    renderCheckout();
  }
}

/* =========================================================
   8. 订单状态（实时更新）
   ========================================================= */
const ord = { id: null, token: null, data: null, timer: null, flags: {} };
const STEPS = ['new', 'making', 'ready', 'done'];

async function enterOrder(query) {
  const q = new URLSearchParams(query);
  ord.id = q.get('id');
  ord.token = q.get('token');
  ord.flags = { paid: q.get('paid') === '1', canceled: q.get('canceled') === '1' };
  ord.data = null;
  $('orderCard').hidden = true;
  $('ordMissing').hidden = true;
  await fetchOrder();
  if (Api.mode === 'live') Api.track(ord.id, ord.token);
  // 演示模式靠轮询模拟进度；真实模式有 WebSocket，轮询只是保险
  stopOrderPolling();
  ord.timer = setInterval(fetchOrder, Api.mode === 'demo' ? 2000 : 20000);
}
function stopOrderPolling() { clearInterval(ord.timer); ord.timer = null; }

async function fetchOrder() {
  if (!ord.id) return;
  try { renderOrder(await Api.getOrder(ord.id, ord.token)); }
  catch (e) {
    if (e.code === 'not_found') { $('orderCard').hidden = true; $('ordMissing').hidden = false; stopOrderPolling(); }
  }
}

function renderOrder(o) {
  const prev = ord.data;
  ord.data = o;
  $('orderCard').hidden = false;
  $('ord-title').textContent = '#' + o.number;
  $('ordStatus').textContent = t('ord.s.' + o.status);
  $('ordStatus').dataset.status = o.status;

  const idx = STEPS.indexOf(o.status);
  $('ordSteps').hidden = o.status === 'cancelled' || o.status === 'awaiting_payment';
  $('ordSteps').innerHTML = STEPS.map((s, i) =>
    `<li class="${i < idx ? 'done' : i === idx ? 'now' : ''}"><span>${t('ord.s.' + s)}</span></li>`).join('');

  const banner = $('ordBanner');
  banner.hidden = !['ready', 'cancelled'].includes(o.status);
  banner.className = 'ord-banner' + (o.status === 'cancelled' ? ' warn' : '');
  banner.textContent = o.status === 'cancelled' ? t('ord.cancelled') : o.type === 'table' ? t('ord.readyBannerTable') : t('ord.readyBanner');

  // 刚变成"可以取餐"：响一声、震一下、发系统通知
  if (prev && prev.status !== 'ready' && o.status === 'ready') {
    Sound.chime();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(t('ord.notifTitle'), { body: t('ord.notifBody', { n: '#' + o.number }) }); } catch (e) { /* 有些手机浏览器不支持 */ }
    }
    if (!reduceMotion()) banner.animate([{ transform: 'scale(.9)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 400, easing: 'cubic-bezier(.3,1.4,.5,1)' });
  }

  $('ordPay').hidden = o.status !== 'awaiting_payment';
  $('ordPayText').textContent = (ord.flags.canceled ? t('ord.payCanceled') + ' ' : '') + t('ord.unpaid');

  const info = [];
  if (o.type === 'table') info.push([t('co.how'), t('ord.table', { n: o.table })]);
  else info.push([t('ord.pickupAt'), !o.pickupAt || o.pickupAt === 'asap' ? t('ord.asap') : shopTime(o.pickupAt)]);
  if (o.name) info.push([t('ord.name'), o.name]);
  info.push([t('co.pay'), o.paid && o.payment === 'online' ? t('ord.paid') : t('ord.payAtStore')]);
  $('ordInfo').innerHTML = info.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');

  $('ordItems').innerHTML = o.items.map(it => `
    <li><div><strong>${esc(it.name ? L(it.name) : t('custom'))}</strong> × ${it.qty}<span>${esc(describe(it.recipe))}</span></div>
    <b>${money(it.unit * it.qty)}</b></li>`).join('');
  $('ordTotals').innerHTML = `
    <div><dt>${t('co.subtotal')}</dt><dd>${money(o.subtotal)}</dd></div>
    <div><dt>${t('co.tax', { name: CFG.shop.taxName })}</dt><dd>${money(o.tax)}</dd></div>
    <div class="grand"><dt>${t('co.total')}</dt><dd>${money(o.total)}</dd></div>`;

  const canNotify = 'Notification' in window && ['new', 'making'].includes(o.status);
  $('ordNotify').hidden = !canNotify;
  if (canNotify) $('ordNotify').textContent = Notification.permission === 'granted' ? t('ord.notifyOn') : t('ord.notify');
  $('ordLive').hidden = ['done', 'cancelled'].includes(o.status);
  if (['done', 'cancelled'].includes(o.status)) stopOrderPolling();
}

function setupOrder() {
  $('coForm').addEventListener('submit', submitOrder);
  $('ordNotify').addEventListener('click', async () => {
    if (Notification.permission !== 'granted') await Notification.requestPermission();
    if (ord.data) renderOrder(ord.data);
  });
  $('ordPayNow').addEventListener('click', async () => {
    try { location.href = (await Api.pay(ord.id, ord.token)).checkoutUrl; }
    catch (e) { toast(t('err.payment')); }
  });
  $('ordPayStore').addEventListener('click', async () => {
    try { renderOrder(await Api.payInStore(ord.id, ord.token)); } catch (e) { toast(t('err.generic')); }
  });
  Api.on('order', o => { if (o.id === ord.id && currentRoute === 'order') renderOrder(o); });
}

/* 顶部的"订单 #042"：最近 4 小时内下过单，就显示一个快捷入口 */
function updateOrderChip() {
  const last = store.get('hitea-my-orders', [])[0];
  const chip = $('orderChip');
  chip.hidden = !(last && Date.now() - last.at < 4 * 3600 * 1000);
  if (!chip.hidden) {
    chip.href = `#/order?id=${encodeURIComponent(last.id)}&token=${encodeURIComponent(last.token)}`;
    chip.innerHTML = `<span class="tool-label">${esc(t('tool.order'))} </span>#${esc(last.number)}`;
  }
}

/* =========================================================
   9. 语言、声音、菜单实时更新、启动
   ========================================================= */
function applyTheme() {
  const th = CFG.theme, root = document.documentElement.style;
  const map = { bg: '--bg', ink: '--ink', inkSoft: '--ink-soft', accent: '--accent', accentDark: '--accent-dark', line: '--line', soft1: '--soft-1', soft2: '--soft-2', soft3: '--soft-3' };
  Object.entries(map).forEach(([k, v]) => { if (th[k]) root.setProperty(v, th[k]); });
  document.querySelector('meta[name=viewport]').insertAdjacentHTML('afterend', `<meta name="theme-color" content="${th.bg}">`);
}

function renderAllText() {
  I18N.apply();
  $('logo').textContent = CFG.shop.name;
  $('ribbon').hidden = !CFG.shop.fictional;
  $('tableBadge').hidden = !table;
  if (table) $('tableBadge').textContent = t('table.badge', { n: table });
  $('navWheel').hidden = !CFG.features.wheel;
  $('homeWheelEntry').hidden = !CFG.features.wheel;
  $('musicBtn').hidden = !CFG.features.music;
  updateTitle();
  updateOrderChip();
}

function rebuildAll() {
  renderAllText();
  buildChips();
  renderDiy();
  buildMenuGrid();
  buildHome();
  buildMoodChips();
  if (CFG.features.wheel) drawWheel($('wheel'), false);
  if (weather.loaded) renderWeather();
  if (!$('result').hidden && picked) showResult();
  renderCart();
  if (currentRoute === 'checkout') renderCheckout();
  if (currentRoute === 'order' && ord.data) renderOrder(ord.data);
}

/* 店员在后台改了菜单（比如珍珠售罄），服务器推送过来，页面马上更新 */
async function refreshMenu() {
  try { MENU = await Api.menu(); } catch (e) { return; }
  Cup.setMenu(MENU);
  const before = cart.length;
  cart = cart.filter(l => recipeOk(l.recipe));
  if (cart.length !== before) { saveCart(); toast(t('cart.removedSoldOut')); }
  else toast(t('toast.menuUpdated'));
  recipe = { ...recipe, tops: recipe.tops.filter(tp => byId(MENU.toppings, tp)?.available !== false) };
  rebuildAll();
}

function setupTools() {
  Sound.init();
  const mb = $('musicBtn'), sb = $('sfxBtn');
  const sync = () => { mb.setAttribute('aria-pressed', Sound.musicOn); sb.setAttribute('aria-pressed', Sound.sfxOn); };
  mb.addEventListener('click', () => { Sound.setMusic(!Sound.musicOn); sync(); });
  sb.addEventListener('click', () => { Sound.setSfx(!Sound.sfxOn); sync(); });
  sync();
  $('langBtn').addEventListener('click', () => { I18N.set(I18N.lang === 'zh' ? 'en' : 'zh'); rebuildAll(); });
}

/* 从 Stripe 付款页回来（?order=..&token=..）或扫桌上二维码进来（?table=5），先整理一下网址 */
function readLandingParams() {
  const q = new URLSearchParams(location.search);
  if (q.get('table')) {
    const n = Number(q.get('table'));
    if (Number.isInteger(n) && n >= 1 && n <= 99) { try { sessionStorage.setItem('hitea-table', n); } catch (e) { /* 忽略 */ } }
  }
  try { const n = Number(sessionStorage.getItem('hitea-table')); table = n >= 1 ? n : null; } catch (e) { table = null; }
  let hash = location.hash;
  if (q.get('order') && q.get('token')) {
    hash = `#/order?id=${encodeURIComponent(q.get('order'))}&token=${encodeURIComponent(q.get('token'))}` +
      (q.get('canceled') ? '&canceled=1' : '') + (q.get('paid') ? '&paid=1' : '');
  }
  if (location.search) history.replaceState(null, '', location.pathname + hash);
}

async function boot() {
  readLandingParams();
  CFG = await Api.init();
  MENU = await Api.menu();
  Cup.setMenu(MENU);
  applyTheme();
  recipe = defaultRecipe();
  setupTools();
  setupDiy();
  setupWheel();
  setupCart();
  setupOrder();
  rebuildAll();
  Api.on('menu', refreshMenu);
  router();
  document.body.classList.remove('loading');
}

boot();
