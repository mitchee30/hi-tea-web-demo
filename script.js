/* =========================================================
   第二部分：状态
   页面上所有东西都由这一个对象决定。改状态，再调用 render()。
   ========================================================= */
const state = { tea: 'black', milk: 'milk', sweet: 50, ice: 'normal', size: 'M', tops: [] };
const mood = { current: 'any' };
const weather = { kind: null, temp: null };   // kind: cold / mild / hot / rain

const byId = (arr, id) => arr.find(x => x.id === id);

/* 把两个颜色按比例混合，用来算"茶 + 奶"之后的颜色 */
function mix(hexA, hexB, t) {
  const a = hexA.match(/\w\w/g).map(h => parseInt(h, 16));
  const b = hexB.match(/\w\w/g).map(h => parseInt(h, 16));
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

function calcPrice() {
  let p = byId(TEAS, state.tea).price + byId(MILKS, state.milk).price + byId(SIZES, state.size).price;
  state.tops.forEach(t => { p += byId(TOPPINGS, t).price; });
  return p;
}

/* =========================================================
   第三部分：生成选项按钮
   一个通用函数，给每组选项生成"小药丸"按钮。
   target 是要修改的状态对象（state 或 mood），key 是字段名。
   ========================================================= */
function makeChips(containerId, items, target, key, { multi = false, max = 99, showPrice = false, dot = false } = {}) {
  const box = document.getElementById(containerId);
  box.innerHTML = '';
  items.forEach(item => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.id = item.id;
    if (dot) b.innerHTML = `<span class="dot" style="background:${item.color}"></span>`;
    b.insertAdjacentHTML('beforeend', item.name);
    if (showPrice && item.price) b.insertAdjacentHTML('beforeend', ` <span class="extra">+$${item.price.toFixed(2)}</span>`);
    b.addEventListener('click', () => {
      if (multi) {
        const list = target[key];
        const i = list.indexOf(item.id);
        if (i >= 0) list.splice(i, 1);
        else if (list.length < max) list.push(item.id);
      } else {
        target[key] = item.id;
      }
      syncChips(containerId, target, key);
      if (target === state) render();
    });
    box.appendChild(b);
  });
  syncChips(containerId, target, key);
}

function syncChips(containerId, target, key) {
  document.querySelectorAll(`#${containerId} .chip`).forEach(b => {
    const val = target[key];
    const on = Array.isArray(val) ? val.includes(b.dataset.id) : String(val) === b.dataset.id;
    b.setAttribute('aria-pressed', on);
  });
}

/* =========================================================
   第四部分：画杯子
   杯子是一个梯形：顶部 y=70 半宽 88，底部 y=318 半宽 68。
   halfWidth(y) 算出某个高度上杯子有多宽，保证小料不会掉到杯子外面。
   ========================================================= */
const SVGNS = 'http://www.w3.org/2000/svg';
const halfWidth = y => 88 - (y - 70) * (20 / 248);
const rand = (a, b) => a + Math.random() * (b - a);
const rendered = {};   // 记录已经画在杯子里的小料，只给新加的播放掉落动画

function placeInCup(yMin, yMax, r) {
  const y = rand(yMin, yMax);
  const hw = halfWidth(y) - r - 6;
  return { x: 120 + rand(-hw, hw), y };
}

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVGNS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

function makeToppingGroup(id) {
  const t = byId(TOPPINGS, id);
  const g = document.createElementNS(SVGNS, 'g');
  if (id === 'cheese') return g;  // 奶盖单独用 #foam 画
  const n = { pearl: 22, brown: 22, coco: 12, taroball: 9, pudding: 1 }[id];
  for (let i = 0; i < n; i++) {
    let el;
    if (id === 'pearl' || id === 'brown') {
      const p = placeInCup(286, 318, 8);
      el = svgEl('circle', { cx: p.x, cy: p.y, r: 8 });
    } else if (id === 'taroball') {
      const p = placeInCup(270, 314, 10);
      el = svgEl('ellipse', { cx: p.x, cy: p.y, rx: 11, ry: 9 });
    } else if (id === 'coco') {
      const p = placeInCup(170, 270, 9);
      el = svgEl('rect', { x: p.x - 7, y: p.y - 7, width: 14, height: 14, rx: 3, opacity: .85 });
    } else {
      el = svgEl('rect', { x: 82, y: 262, width: 70, height: 46, rx: 10 });
    }
    el.setAttribute('fill', t.color);
    el.classList.add('piece', 'drop');
    el.style.transitionDelay = (i * 0.035) + 's';  // 一颗一颗错开掉下去
    g.appendChild(el);
  }
  return g;
}

function drawIce() {
  const old = document.getElementById('iceGroup');
  if (old) old.remove();
  const g = svgEl('g', { id: 'iceGroup' });
  const cubes = byId(ICES, state.ice).cubes;
  const spots = [[80, 112, -12], [130, 106, 8], [160, 130, -6], [100, 140, 14]];
  for (let i = 0; i < cubes; i++) {
    const [x, y, rot] = spots[i];
    g.appendChild(svgEl('rect', {
      x, y, width: 30, height: 30, rx: 6, fill: '#FFFFFF', opacity: .55,
      transform: `rotate(${rot} ${x + 15} ${y + 15})`,
    }));
  }
  document.getElementById('pieces').appendChild(g);
}

function drawCup() {
  const tea = byId(TEAS, state.tea);
  const milk = byId(MILKS, state.milk);
  // 茶色 + 奶白；糖越多颜色越暖一点点
  let color = mix(tea.color, '#F7EDE2', milk.mix);
  color = mix(color, '#C27A3A', state.sweet / 1000);
  const liquid = document.getElementById('liquid');
  liquid.setAttribute('fill', color);

  // 奶盖：有就在顶部画一层奶油色，液面相应往下
  const hasCheese = state.tops.includes('cheese');
  document.getElementById('foam').setAttribute('height', hasCheese ? 34 : 0);
  liquid.setAttribute('y', hasCheese ? 108 : 96);

  // 热饮冒热气
  document.getElementById('steam').classList.toggle('on', state.ice === 'hot');

  // 小料：新加的画出来并播放掉落动画，取消的删掉
  const piecesBox = document.getElementById('pieces');
  TOPPINGS.forEach(t => {
    const want = state.tops.includes(t.id);
    if (want && !rendered[t.id]) {
      const g = makeToppingGroup(t.id);
      piecesBox.prepend(g);
      rendered[t.id] = g;
      // 等浏览器先画出"掉落前"的位置，下一帧再移除 drop，触发动画
      requestAnimationFrame(() => requestAnimationFrame(() => {
        g.querySelectorAll('.piece').forEach(p => p.classList.remove('drop'));
      }));
    } else if (!want && rendered[t.id]) {
      rendered[t.id].remove();
      delete rendered[t.id];
    }
  });
  drawIce();
}

/* =========================================================
   第五部分：render() 把状态同步到整个页面
   ========================================================= */
function render() {
  [['opt-tea', 'tea'], ['opt-milk', 'milk'], ['opt-sweet', 'sweet'], ['opt-ice', 'ice'], ['opt-size', 'size'], ['opt-top', 'tops']]
    .forEach(([c, k]) => syncChips(c, state, k));
  drawCup();
  document.getElementById('price').textContent = '$' + calcPrice().toFixed(2);
  const parts = [
    byId(TEAS, state.tea).name, byId(MILKS, state.milk).name,
    byId(SWEETS, state.sweet).name, byId(ICES, state.ice).name,
    ...state.tops.map(t => byId(TOPPINGS, t).name),
  ];
  document.getElementById('summary').textContent = parts.join('，');
}

/* 下单（演示） */
document.getElementById('orderBtn').addEventListener('click', () => {
  document.getElementById('orderText').textContent =
    `${byId(SIZES, state.size).name}，${document.getElementById('summary').textContent}，共 ${document.getElementById('price').textContent}`;
  document.getElementById('pickupNo').textContent = String(Math.floor(rand(1, 999))).padStart(3, '0');
  document.getElementById('orderDialog').showModal();
});
document.getElementById('closeDialog').addEventListener('click', () => document.getElementById('orderDialog').close());

/* 把某个招牌饮品的配方载入"调一杯" */
function loadPreset(drink) {
  Object.assign(state, { ...drink.preset, tops: [...drink.preset.tops] });
  render();
  document.getElementById('builder').scrollIntoView({ behavior: 'smooth' });
}

/* =========================================================
   第六部分：今天喝什么
   1. 用 Open-Meteo（免费、不用 API key）拿 Kitchener 当前天气
   2. 天气 + 心情 给每杯饮品打分，选出最高分
   3. 转盘转到那一格
   ========================================================= */
const MOODS = [
  { id: 'wake',  name: '要提神' },
  { id: 'sweet', name: '想吃甜的' },
  { id: 'fresh', name: '想清爽一点' },
  { id: 'any',   name: '随便，你定' },
];
const WEATHER_TEXT = { cold: '有点冷', mild: '不冷不热', hot: '挺热的', rain: '在下雨' };

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
    renderWeather(`Kitchener 现在 ${t}°C，${WEATHER_TEXT[weather.kind]}。不对的话可以改：`);
  } catch (e) {
    // 拿不到天气时，让用户自己选，页面照样能用
    weather.kind = 'mild';
    renderWeather('暂时拿不到天气，你可以手动选：');
  }
}
function renderWeather(prefix) {
  const el = document.getElementById('weather');
  el.textContent = prefix;
  const sel = document.createElement('select');
  sel.setAttribute('aria-label', '今天的天气');
  Object.entries(WEATHER_TEXT).forEach(([k, v]) => sel.add(new Option(v, k, false, k === weather.kind)));
  sel.addEventListener('change', e => { weather.kind = e.target.value; });
  el.appendChild(sel);
}

function scoreDrink(d) {
  let s = Math.random() * 1.5;  // 一点随机，同样条件也不会每次都一样
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

/* 画转盘：8 格，每格 45 度 */
const SEG_COLORS = ['#9B7FC4', '#F2A7B8', '#9A5A26', '#C9B8DD', '#6E9A5B', '#F7D5DC', '#2B1D3F', '#E0823A'];
const DARK_SEGS = ['#9A5A26', '#6E9A5B', '#2B1D3F'];
function drawWheel() {
  const g = document.getElementById('wheel-rot');
  const cx = 200, cy = 200, r = 190;
  DRINKS.forEach((d, i) => {
    const a0 = (i * 45 - 90) * Math.PI / 180, a1 = ((i + 1) * 45 - 90) * Math.PI / 180;
    g.appendChild(svgEl('path', {
      d: `M${cx} ${cy} L${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A${r} ${r} 0 0 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} Z`,
      fill: SEG_COLORS[i], stroke: '#fff', 'stroke-width': 3,
    }));
    const text = svgEl('text', {
      x: cx, y: cy - 125, 'text-anchor': 'middle', 'font-family': 'ZCOOL KuaiLe, sans-serif', 'font-size': 22,
      fill: DARK_SEGS.includes(SEG_COLORS[i]) ? '#fff' : '#2B1D3F',
      transform: `rotate(${i * 45 + 22.5} ${cx} ${cy})`,
    });
    text.textContent = d.short;
    g.appendChild(text);
  });
  g.appendChild(svgEl('circle', { cx, cy, r: 26, fill: '#fff' }));
}

let wheelAngle = 0;
let picked = null;
document.getElementById('spinBtn').addEventListener('click', () => {
  // 1. 打分选饮品
  const ranked = DRINKS.map((d, i) => ({ d, i, s: scoreDrink(d) })).sort((a, b) => b.s - a.s);
  const { d, i } = ranked[0];
  const makeHot = (weather.kind === 'cold' || weather.kind === 'rain') && d.tags.includes('warmok');
  picked = { ...d, preset: { ...d.preset, ice: makeHot ? 'hot' : d.preset.ice } };

  // 2. 算转盘要转多少度：让第 i 格的中心转到正上方的指针下面，再多转 5 圈
  const target = 360 - (i * 45 + 22.5);
  const current = ((wheelAngle % 360) + 360) % 360;
  wheelAngle += 360 * 5 + ((target - current + 360) % 360);
  document.getElementById('wheel-rot').style.transform = `rotate(${wheelAngle}deg)`;

  // 3. 转完再显示结果
  const btn = document.getElementById('spinBtn');
  btn.disabled = true;
  document.getElementById('result').classList.remove('show');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(() => {
    document.getElementById('resultName').textContent = d.name;
    document.getElementById('resultWhy').textContent = reasonFor(makeHot);
    document.getElementById('result').classList.add('show');
    btn.disabled = false;
    btn.textContent = '再选一次';
  }, reduce ? 50 : 4300);
});
document.getElementById('useResult').addEventListener('click', () => picked && loadPreset(picked));

/* =========================================================
   第七部分：启动
   ========================================================= */
makeChips('opt-tea', TEAS, state, 'tea', { dot: true });
makeChips('opt-milk', MILKS, state, 'milk', { showPrice: true });
makeChips('opt-sweet', SWEETS, state, 'sweet');
makeChips('opt-ice', ICES, state, 'ice');
makeChips('opt-size', SIZES, state, 'size', { showPrice: true });
makeChips('opt-top', TOPPINGS, state, 'tops', { multi: true, max: 3, showPrice: true, dot: true });
makeChips('opt-mood', MOODS, mood, 'current');

const menu = document.getElementById('menuList');
DRINKS.forEach(d => {
  const li = document.createElement('li');
  li.innerHTML = `<span class="name">${d.name}<span class="en">${d.en}</span></span>`;
  const b = document.createElement('button');
  b.textContent = '调这杯';
  b.onclick = () => loadPreset(d);
  li.appendChild(b);
  menu.appendChild(li);
});

drawWheel();
render();
loadWeather();