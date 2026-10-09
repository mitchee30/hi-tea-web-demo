/* =========================================================
   script.js：页面逻辑
   一共五块：
   1. 工具函数（价格、配方和网址互相转换）
   2. 路由：根据网址里 # 后面的部分，决定显示哪个页面
   3. DIY 页面
   4. 菜单页面、首页
   5. 转盘页面
   6. 购物车、提示、声音开关
   ========================================================= */

const $ = id => document.getElementById(id);
const byId = (arr, id) => arr.find(x => x.id === id);

/* =========================================================
   1. 工具函数
   ========================================================= */
const DEFAULT_RECIPE = { tea: 'black', milk: 'milk', sweet: 50, ice: 'normal', size: 'M', tops: [] };

function priceOf(r) {
  let p = byId(TEAS, r.tea).price + byId(MILKS, r.milk).price + byId(SIZES, r.size).price;
  r.tops.forEach(t => { p += byId(TOPPINGS, t).price; });
  return p;
}
const money = n => '$' + n.toFixed(2);

function describe(r) {
  return [
    byId(SIZES, r.size).name, byId(TEAS, r.tea).name, byId(MILKS, r.milk).name,
    byId(SWEETS, r.sweet).name, byId(ICES, r.ice).name,
    ...r.tops.map(t => byId(TOPPINGS, t).name),
  ].join('，');
}

// 配方 → 网址参数，比如 tea=taro&milk=milk&sweet=50&ice=less&size=M&tops=pearl,taroball
function toQuery(r) {
  const q = new URLSearchParams({ tea: r.tea, milk: r.milk, sweet: r.sweet, ice: r.ice, size: r.size });
  if (r.tops.length) q.set('tops', r.tops.join(','));
  return q.toString();
}

// 网址参数 → 配方。网址是别人可以随便改的，所以每一项都要检查是否合法
function fromQuery(qs) {
  const q = new URLSearchParams(qs);
  const pick = (list, key, fallback, num) => {
    const v = q.get(key);
    if (v === null) return fallback;
    const val = num ? Number(v) : v;
    return list.some(x => x.id === val) ? val : fallback;
  };
  const tops = (q.get('tops') || '').split(',').filter(t => TOPPINGS.some(x => x.id === t));
  return {
    tea: pick(TEAS, 'tea', DEFAULT_RECIPE.tea),
    milk: pick(MILKS, 'milk', DEFAULT_RECIPE.milk),
    sweet: pick(SWEETS, 'sweet', DEFAULT_RECIPE.sweet, true),
    ice: pick(ICES, 'ice', DEFAULT_RECIPE.ice),
    size: pick(SIZES, 'size', DEFAULT_RECIPE.size),
    tops: [...new Set(tops)].slice(0, 3),
  };
}

// 两个配方是不是同一杯（用来判断 DIY 的那杯是不是刚好等于某个招牌）
const sameRecipe = (a, b) => toQuery({ ...a, tops: [...a.tops].sort() }) === toQuery({ ...b, tops: [...b.tops].sort() });

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* =========================================================
   2. 路由
   网址长这样：
     #/          首页
     #/diy       自己调（可以带配方：#/diy?tea=taro&tops=pearl）
     #/menu      招牌菜单
     #/wheel     今天喝什么
   只是 # 后面变了，浏览器不会重新加载页面，所以背景音乐不会断。
   ========================================================= */
const ROUTES = {
  home:  { view: 'view-home',  title: 'Hi Tea' },
  diy:   { view: 'view-diy',   title: '自己调一杯 · Hi Tea' },
  menu:  { view: 'view-menu',  title: '招牌菜单 · Hi Tea' },
  wheel: { view: 'view-wheel', title: '今天喝什么 · Hi Tea' },
};

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  return { name: ROUTES[path] ? path : 'home', query };
}

let firstRoute = true;
function router() {
  const { name, query } = parseHash();
  Object.entries(ROUTES).forEach(([key, r]) => { $(r.view).hidden = key !== name; });
  document.querySelectorAll('.tabs a').forEach(a => {
    if (a.dataset.route === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title = ROUTES[name].title;
  document.body.dataset.route = name;

  if (name === 'diy') enterDiy(query);
  if (name === 'wheel') enterWheel();

  // 换页后回到顶部，并把焦点放到标题上（用键盘和读屏软件的人才知道换页了）
  if (!firstRoute) {
    window.scrollTo(0, 0);
    const h = $(ROUTES[name].view).querySelector('h1');
    if (h) h.focus({ preventScroll: true });
  }
  firstRoute = false;
}
window.addEventListener('hashchange', router);

/* =========================================================
   3. DIY 页面
   ========================================================= */
let recipe = { ...DEFAULT_RECIPE, tops: [] };
let diyCup = null;

function makeChips(boxId, items, getVal, setVal, { multi = false, max = 99, showPrice = false, swatch = null } = {}) {
  const box = $(boxId);
  box.innerHTML = '';
  items.forEach(item => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.id = item.id;
    if (swatch) b.insertAdjacentHTML('beforeend', `<span class="dot" style="background:${swatch(item)}"></span>`);
    b.insertAdjacentHTML('beforeend', `<span>${item.name}</span>`);
    if (showPrice && item.price) b.insertAdjacentHTML('beforeend', `<span class="extra">+$${item.price.toFixed(2)}</span>`);
    b.addEventListener('click', () => {
      if (multi) {
        const list = [...getVal()];
        const i = list.indexOf(item.id);
        if (i >= 0) list.splice(i, 1);
        else if (list.length < max) list.push(item.id);
        else { toast(`小料最多选 ${max} 种`); return; }
        setVal(list);
      } else {
        setVal(item.id);
      }
    });
    box.appendChild(b);
  });
}

function syncChips(boxId, val) {
  document.querySelectorAll(`#${boxId} .chip`).forEach(b => {
    const on = Array.isArray(val) ? val.includes(b.dataset.id) : String(val) === b.dataset.id;
    b.setAttribute('aria-pressed', on);
  });
}

function setRecipe(patch, { sound = true } = {}) {
  const prev = recipe;
  recipe = { ...recipe, ...patch, tops: patch.tops ? [...patch.tops] : [...recipe.tops] };
  if (sound) {
    if (patch.tea && patch.tea !== prev.tea) Sound.pour();
    if (patch.milk && patch.milk !== prev.milk) Sound.pour();
    if (patch.ice && ICES.find(i => i.id === patch.ice).cubes > ICES.find(i => i.id === prev.ice).cubes) Sound.clink();
  }
  renderDiy();
  // 把当前配方写进网址：这样复制网址就能分享这一杯。
  // replaceState 只改网址，不会触发 hashchange，也不会多一条浏览记录
  history.replaceState(null, '', '#/diy?' + toQuery(recipe));
}

function renderDiy() {
  syncChips('opt-tea', recipe.tea);
  syncChips('opt-milk', recipe.milk);
  syncChips('opt-sweet', recipe.sweet);
  syncChips('opt-ice', recipe.ice);
  syncChips('opt-size', recipe.size);
  syncChips('opt-top', recipe.tops);
  diyCup.update(recipe);
  $('summary').textContent = describe(recipe);
  $('price').textContent = money(priceOf(recipe));
  diyCup.svg.setAttribute('aria-label', '你调的饮品：' + describe(recipe));
}

function enterDiy(query) {
  if (query) recipe = fromQuery(query);
  renderDiy();
}

function setupDiy() {
  diyCup = Cup.create($('diyCup'), { size: 'lg', onLand: () => Sound.plop() });
  makeChips('opt-tea', TEAS, () => recipe.tea, v => setRecipe({ tea: v }), { swatch: t => `linear-gradient(${t.top}, ${t.bottom})` });
  makeChips('opt-milk', MILKS, () => recipe.milk, v => setRecipe({ milk: v }), { showPrice: true });
  makeChips('opt-sweet', SWEETS, () => recipe.sweet, v => setRecipe({ sweet: v }));
  makeChips('opt-ice', ICES, () => recipe.ice, v => setRecipe({ ice: v }));
  makeChips('opt-size', SIZES, () => recipe.size, v => setRecipe({ size: v }), { showPrice: true });
  makeChips('opt-top', TOPPINGS, () => recipe.tops, v => setRecipe({ tops: v }),
    { multi: true, max: 3, showPrice: true, swatch: t => `radial-gradient(circle at 35% 30%, ${t.light}, ${t.dark})` });

  $('addDiyBtn').addEventListener('click', () => addToCart(recipe));
  $('resetBtn').addEventListener('click', () => setRecipe({ ...DEFAULT_RECIPE, tops: [] }, { sound: false }));
  $('shareBtn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast('链接已复制，发给朋友就能看到这一杯');
    } catch (e) {
      toast('复制失败，可以直接复制浏览器地址栏的网址');
    }
  });
}

/* =========================================================
   4. 菜单页面和首页
   ========================================================= */
function setupMenu() {
  const grid = $('menuGrid');
  DRINKS.forEach((d, i) => {
    const li = document.createElement('li');
    li.className = 'menu-card';
    li.innerHTML = `
      <div class="menu-cup"></div>
      <div class="menu-body">
        <h2>${d.name}</h2>
        <p class="en">${d.en}</p>
        <p class="desc">${d.desc}</p>
        <div class="menu-foot">
          <span class="price-sm">${money(priceOf(d.preset))}</span>
          <a class="link-btn" href="#/diy?${toQuery(d.preset)}">改一改</a>
          <button class="btn btn-sm">加入购物车</button>
        </div>
      </div>`;
    const cup = Cup.create(li.querySelector('.menu-cup'), { size: 'sm', seed: 101 + i });
    cup.update(d.preset);
    cup.svg.setAttribute('aria-label', d.name);
    li.querySelector('button').addEventListener('click', () => addToCart(d.preset, d.name));
    grid.appendChild(li);
  });
}

function setupHome() {
  // DIY 入口：一杯慢慢"加料"的芋泥波波
  const hc = Cup.create($('homeCup'), { size: 'sm', seed: 7 });
  hc.update(DRINKS[2].preset);
  hc.svg.setAttribute('aria-hidden', 'true');
  // 菜单入口：三杯叠在一起
  [0, 3, 4].forEach((di, k) => {
    const c = Cup.create($('homeMenuCups'), { size: 'sm', seed: 31 + k });
    c.update(DRINKS[di].preset);
    c.svg.setAttribute('aria-hidden', 'true');
  });
  // 转盘入口：一个小转盘
  drawWheel($('homeWheel'), true);
}

/* =========================================================
   5. 转盘页面
   ========================================================= */
const mood = { current: 'any' };
const weather = { kind: null, temp: null, loaded: false };
const WEATHER_TEXT = { cold: '有点冷', mild: '不冷不热', hot: '挺热的', rain: '在下雨' };
const SEG_COLORS = ['#9B7FC4', '#F2A7B8', '#9A5A26', '#C9B8DD', '#6E9A5B', '#F7D5DC', '#2B1D3F', '#E0823A'];
const DARK_SEGS = ['#9A5A26', '#6E9A5B', '#2B1D3F', '#9B7FC4', '#E0823A'];
const SEG = 360 / DRINKS.length;
const SVGNS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

/* 画转盘。文字沿着半径方向排；左半边的字转 180°，这样每一格的字都是正着读的 */
function drawWheel(target, mini) {
  const g = mini ? target : target.querySelector('#wheel-rot');
  const cx = 200, cy = 200, r = 190;
  DRINKS.forEach((d, i) => {
    const a0 = (i * SEG - 90) * Math.PI / 180, a1 = ((i + 1) * SEG - 90) * Math.PI / 180;
    svgEl('path', {
      d: `M${cx} ${cy} L${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A${r} ${r} 0 0 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} Z`,
      fill: SEG_COLORS[i], stroke: '#fff', 'stroke-width': 4,
    }, g);
    if (mini) return;
    const mid = i * SEG + SEG / 2;                 // 这一格中线的角度（0 = 正上方，顺时针）
    const rad = (mid - 90) * Math.PI / 180;
    const tx = cx + 122 * Math.cos(rad), ty = cy + 122 * Math.sin(rad);
    const flip = mid > 180;                        // 左半边：转 180° 才是正的
    const text = svgEl('text', {
      x: tx, y: ty, 'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-family': 'ZCOOL KuaiLe, sans-serif', 'font-size': 23,
      fill: DARK_SEGS.includes(SEG_COLORS[i]) ? '#fff' : '#2B1D3F',
      transform: `rotate(${flip ? mid + 90 : mid - 90} ${tx} ${ty})`,
    }, g);
    text.textContent = d.short;
  });
  svgEl('circle', { cx, cy, r: mini ? 34 : 30, fill: '#fff' }, g);
  if (!mini) svgEl('circle', { cx, cy, r: 12, fill: '#2B1D3F' }, g);
}

async function loadWeather() {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 5000);
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=43.45&longitude=-80.49&current=temperature_2m,precipitation,weather_code';
    const res = await fetch(url, { signal: ctrl.signal });
    const data = await res.json();
    const t = Math.round(data.current.temperature_2m);
    const code = data.current.weather_code;
    const raining = data.current.precipitation > 0 || (code >= 51 && code <= 82);
    weather.temp = t;
    weather.kind = raining ? 'rain' : t < 10 ? 'cold' : t >= 24 ? 'hot' : 'mild';
    renderWeather(`Kitchener-Waterloo 现在 ${t}°C，${WEATHER_TEXT[weather.kind]}。不对的话可以改：`);
  } catch (e) {
    weather.kind = 'mild';
    renderWeather('暂时拿不到天气，你可以手动选：');
  }
}

function renderWeather(prefix) {
  const el = $('weather');
  el.textContent = prefix;
  const sel = document.createElement('select');
  sel.setAttribute('aria-label', '今天的天气');
  Object.entries(WEATHER_TEXT).forEach(([k, v]) => sel.add(new Option(v, k, false, k === weather.kind)));
  sel.addEventListener('change', e => { weather.kind = e.target.value; });
  el.appendChild(sel);
}

function enterWheel() {
  if (!weather.loaded) { weather.loaded = true; loadWeather(); }
}

function scoreDrink(d) {
  let s = Math.random() * 1.5;
  if (weather.kind === 'cold' || weather.kind === 'rain') { if (d.tags.includes('warmok')) s += 3; if (d.tags.includes('cozy')) s += 2; }
  if (weather.kind === 'hot') { if (d.tags.includes('fruity')) s += 3; if (d.tags.includes('fresh')) s += 2; }
  if (mood.current === 'wake' && d.tags.includes('caffeine')) s += 3;
  if (mood.current === 'sweet' && d.tags.includes('sweet')) s += 3;
  if (mood.current === 'fresh' && (d.tags.includes('fresh') || d.tags.includes('fruity'))) s += 3;
  if (mood.current === 'any') s += Math.random() * 3;
  return s;
}

function reasonFor(makeHot) {
  const w = {
    cold: '外面有点冷，来一杯热的暖暖手。',
    rain: '下雨天，适合捧着一杯热饮慢慢喝。',
    hot: '天这么热，喝点冰的清爽一下。',
    mild: '今天天气舒服，正适合来一杯。',
  }[weather.kind];
  const m = { wake: '茶底带咖啡因，下午不犯困。', sweet: '甜度刚好，治愈一下。', fresh: '口感清爽，不腻。', any: '这杯是店里的人气款。' }[mood.current];
  return w + m + (makeHot ? '已经帮你改成热的了。' : '');
}

let wheelAngle = 0;
let picked = null;
let resultCup = null;

/* 转盘动画用 JavaScript 一帧一帧算角度，而不是交给 CSS，
   这样才能知道"现在指针指到哪一格"，每过一格就"嗒"一声 */
function spin() {
  const ranked = DRINKS.map((d, i) => ({ d, i, s: scoreDrink(d) })).sort((a, b) => b.s - a.s);
  const { d, i } = ranked[0];
  const makeHot = (weather.kind === 'cold' || weather.kind === 'rain') && d.tags.includes('warmok');
  picked = { name: d.name, recipe: { ...d.preset, tops: [...d.preset.tops], ice: makeHot ? 'hot' : d.preset.ice } };

  const target = 360 - (i * SEG + SEG / 2);
  const current = ((wheelAngle % 360) + 360) % 360;
  const from = wheelAngle;
  const to = wheelAngle + 360 * 5 + ((target - current + 360) % 360);
  const dur = reduceMotion() ? 1 : 4200;
  const g = $('wheel-rot');
  const btn = $('spinBtn');
  btn.disabled = true;
  $('result').hidden = true;

  const start = performance.now();
  let lastSeg = null;
  const easeOut = x => 1 - Math.pow(1 - x, 4);
  function frame(now) {
    const p = Math.min(1, (now - start) / dur);
    wheelAngle = from + (to - from) * easeOut(p);
    g.setAttribute('transform', `rotate(${wheelAngle} 200 200)`);
    const seg = Math.floor((((360 - wheelAngle) % 360) + 360) % 360 / SEG);
    if (seg !== lastSeg) { if (lastSeg !== null) Sound.tick(); lastSeg = seg; }
    if (p < 1) requestAnimationFrame(frame);
    else showResult(d, makeHot);
  }
  requestAnimationFrame(frame);
}

function showResult(d, makeHot) {
  $('resultName').textContent = d.name;
  $('resultWhy').textContent = reasonFor(makeHot);
  $('resultCup').innerHTML = '';
  resultCup = Cup.create($('resultCup'), { size: 'sm', seed: 55 });
  resultCup.update(picked.recipe);
  resultCup.svg.setAttribute('aria-hidden', 'true');
  $('result').hidden = false;
  $('spinBtn').disabled = false;
  $('spinBtn').textContent = '再选一次';
  Sound.chime();
}

function setupWheel() {
  drawWheel($('wheel'), false);
  makeChips('opt-mood', MOODS, () => mood.current, v => { mood.current = v; syncChips('opt-mood', v); });
  syncChips('opt-mood', mood.current);
  $('spinBtn').addEventListener('click', spin);
  $('resultAdd').addEventListener('click', () => picked && addToCart(picked.recipe, picked.name));
  $('resultDiy').addEventListener('click', () => { if (picked) location.hash = '#/diy?' + toQuery(picked.recipe); });
}

/* =========================================================
   6. 购物车、提示、声音开关
   购物车存在 localStorage 里，刷新页面也不会丢。
   ========================================================= */
let cart = [];

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem('hitea-cart') || '[]');
    cart = raw.filter(it => it && it.query).map(it => ({ name: it.name, recipe: fromQuery(it.query), qty: Math.max(1, Math.min(20, it.qty | 0)) }));
  } catch (e) { cart = []; }
}
function saveCart() {
  try { localStorage.setItem('hitea-cart', JSON.stringify(cart.map(it => ({ name: it.name, query: toQuery(it.recipe), qty: it.qty })))); } catch (e) { /* 存不了就算了 */ }
}

function nameFor(r) {
  const d = DRINKS.find(x => sameRecipe(x.preset, r));
  return d ? d.name : '我的特调';
}

function addToCart(r, name) {
  const item = { name: name || nameFor(r), recipe: { ...r, tops: [...r.tops] }, qty: 1 };
  const same = cart.find(it => it.name === item.name && sameRecipe(it.recipe, item.recipe));
  if (same) same.qty++;
  else cart.push(item);
  saveCart();
  renderCart();
  Sound.chime();
  toast(`已加入购物车：${item.name}`);
  const btn = $('cartBtn');
  if (!reduceMotion()) btn.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 350 });
}

function renderCart() {
  const count = cart.reduce((s, it) => s + it.qty, 0);
  $('cartCount').textContent = count;
  $('cartCount').hidden = count === 0;
  $('cartBtn').setAttribute('aria-label', `购物车，${count} 杯`);
  const list = $('cartList');
  list.innerHTML = '';
  cart.forEach((it, idx) => {
    const li = document.createElement('li');
    li.className = 'cart-item';
    li.innerHTML = `
      <div class="cart-info">
        <strong>${it.name}</strong>
        <span>${describe(it.recipe)}</span>
      </div>
      <div class="qty">
        <button class="icon-btn" aria-label="少一杯">−</button>
        <span>${it.qty}</span>
        <button class="icon-btn" aria-label="多一杯">+</button>
      </div>
      <span class="cart-price">${money(priceOf(it.recipe) * it.qty)}</span>`;
    const [minus, plus] = li.querySelectorAll('button');
    minus.addEventListener('click', () => { it.qty--; if (it.qty <= 0) cart.splice(idx, 1); saveCart(); renderCart(); });
    plus.addEventListener('click', () => { it.qty = Math.min(20, it.qty + 1); saveCart(); renderCart(); });
    list.appendChild(li);
  });
  const total = cart.reduce((s, it) => s + priceOf(it.recipe) * it.qty, 0);
  $('cartTotal').textContent = money(total);
  $('cartEmpty').hidden = cart.length > 0;
  $('cartFoot').hidden = cart.length === 0;
}

function setupCart() {
  loadCart();
  renderCart();
  $('cartBtn').addEventListener('click', () => $('cartDialog').showModal());
  $('cartClose').addEventListener('click', () => $('cartDialog').close());
  $('cartToMenu').addEventListener('click', () => $('cartDialog').close());
  // 点灰色背景也能关掉
  $('cartDialog').addEventListener('click', e => { if (e.target === $('cartDialog')) $('cartDialog').close(); });
  $('checkoutBtn').addEventListener('click', () => {
    const count = cart.reduce((s, it) => s + it.qty, 0);
    const total = cart.reduce((s, it) => s + priceOf(it.recipe) * it.qty, 0);
    $('orderText').textContent = `一共 ${count} 杯，合计 ${money(total)}。`;
    $('pickupNo').textContent = String(Math.floor(1 + Math.random() * 998)).padStart(3, '0');
    cart = [];
    saveCart();
    renderCart();
    $('cartDialog').close();
    $('orderDialog').showModal();
    Sound.chime();
  });
  $('orderClose').addEventListener('click', () => $('orderDialog').close());
}

let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

function setupSound() {
  Sound.init();
  const mb = $('musicBtn'), sb = $('sfxBtn');
  const sync = () => {
    mb.setAttribute('aria-pressed', Sound.musicOn);
    sb.setAttribute('aria-pressed', Sound.sfxOn);
  };
  mb.addEventListener('click', () => { Sound.setMusic(!Sound.musicOn); sync(); });
  sb.addEventListener('click', () => { Sound.setSfx(!Sound.sfxOn); sync(); });
  sync();
}

/* =========================================================
   启动
   ========================================================= */
setupSound();
setupDiy();
setupMenu();
setupHome();
setupWheel();
setupCart();
router();
