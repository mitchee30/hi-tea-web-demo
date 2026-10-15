/* =========================================================
   story.js：首页的"滚动故事"
   参考那种"往下滚，产品被一层层拆开"的网站效果：
   1. 开场：一杯完整的奶茶，大标题
   2. THE STACK：往下滚，杯子拆成六层，每层拉出说明
   3. PICK YOUR BASE：杯子合回去，跟着滚动换茶底，背景光跟着变色
   4. THE LINEUP：招牌饮品横着滑过来，点一下就能下单

   原理：两个很高的区块（几屏高），里面的舞台用 position: sticky 固定在屏幕上。
   根据"滚了这个区块的百分之几"（0~1）算出每一层的位置、透明度。
   系统设置了"减少动态效果"时，不固定、不动，直接显示拆开后的样子。
   ========================================================= */

I18N.extend('zh', {
  'story.kicker': 'HI TEA · 一杯奶茶是怎么做成的',
  'story.introSub': '往下滑，把一杯奶茶拆开看看。',
  'story.scroll': '往下滑',
  'story.stackSub': '六层，每一层都可以换成你喜欢的。',
  'story.l.lid': '杯盖和粗吸管', 'story.l.lidD': '珍珠一口一颗，不会卡住',
  'story.l.foam': '芝士奶盖', 'story.l.foamD': '现打，咸甜口，可以不加',
  'story.l.ice': '冰', 'story.l.iceD': '去冰、少冰、正常冰，也可以要热的',
  'story.l.tea': '茶底', 'story.l.teaD': '{n} 种茶底，小批量现泡',
  'story.l.milk': '奶', 'story.l.milkD': '鲜奶，或者无乳的燕麦奶',
  'story.l.pearls': '珍珠', 'story.l.pearlsD': '黑糖慢煮，Q 弹有嚼劲',
  'story.baseKicker': 'PICK YOUR BASE · 选一个茶底',
  'story.from': '{p} 起',
  'story.tryBase': '用这个茶底调一杯',
  'story.lineupSub': '店里的招牌配方。直接加入购物车，或者点进去改一改。',
  'story.build': '自己调一杯',
  'story.nav.intro': '开场', 'story.nav.stack': '拆开', 'story.nav.base': '茶底', 'story.nav.lineup': '招牌',
});
I18N.extend('en', {
  'story.kicker': 'HI TEA · HOW A CUP COMES TOGETHER',
  'story.introSub': 'Scroll down and take a cup apart.',
  'story.scroll': 'Scroll',
  'story.stackSub': 'Six layers, and you choose every one.',
  'story.l.lid': 'Lid & wide straw', 'story.l.lidD': 'One pearl per sip, no clogging',
  'story.l.foam': 'Cheese foam', 'story.l.foamD': 'Whipped to order, salty-sweet, optional',
  'story.l.ice': 'Ice', 'story.l.iceD': 'None, less, normal, or served hot',
  'story.l.tea': 'Tea base', 'story.l.teaD': '{n} bases, brewed in small batches',
  'story.l.milk': 'Milk', 'story.l.milkD': 'Fresh milk, or oat for dairy-free',
  'story.l.pearls': 'Pearls', 'story.l.pearlsD': 'Slow-cooked in brown sugar, chewy',
  'story.baseKicker': 'PICK YOUR BASE',
  'story.from': 'from {p}',
  'story.tryBase': 'Build one with this base',
  'story.lineupSub': 'Our signature recipes. Add one straight to your cart, or open it and tweak it.',
  'story.build': 'Build your own',
  'story.nav.intro': 'Intro', 'story.nav.stack': 'The stack', 'story.nav.base': 'Tea base', 'story.nav.lineup': 'Lineup',
});

const Story = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  // 杯子在 SVG 里的位置（viewBox 0 0 600 760）
  const CX = 200, RIM = 230, HW0 = 112, HW1 = 84, CUP_H = 300, GAP = 44;
  const LX = 352;                                  // 说明文字从这里开始
  const hw = y => HW0 - (HW0 - HW1) * (y / CUP_H);  // 某个高度的杯子半宽
  const RYK = 0.2;                                 // 椭圆扁的程度，越小越"俯视"
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const span = (p, a, b) => clamp((p - a) / (b - a));

  // 从上到下六层：[名字, 顶部 y, 底部 y]（相对杯口）
  const LAYERS = [
    ['lid', -8, 8], ['foam', 8, 42], ['ice', 42, 84], ['tea', 84, 172], ['milk', 172, 234], ['pearls', 234, 300],
  ];

  let built = false, svg, layerGs = [], leaderGs = [], labels = [], glass, cupG, teaStops, milkStops, flavorIdx = -1;
  let stage, storyEl, lineupEl, row, floor, ticking = false, teas = [];
  // 看得到的范围：电脑上留出右边写说明的位置；手机上裁掉多余的空白，杯子显得大一点
  const VB_WIDE = [0, 0, 600, 760], VB_NARROW = [70, 70, 500, 660];
  let vb = VB_WIDE;

  function el(tag, attrs = {}, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* 一层"切片"：前面是杯壁的一段，上面是一个椭圆的液面，看起来像立体的 */
  function slicePath(y0, y1) {
    const a = hw(y0), b = hw(y1);
    return `M${CX - a} ${y0} L${CX - b} ${y1} A${b} ${b * RYK} 0 0 0 ${CX + b} ${y1} L${CX + a} ${y0} A${a} ${a * RYK} 0 0 1 ${CX - a} ${y0} Z`;
  }
  function slice(g, name, y0, y1, body, top, defs) {
    const d = slicePath(y0, y1);
    el('path', { d, fill: body }, g);
    el('path', { d, fill: 'url(#st-shade)' }, g);             // 两边暗、中间亮，像圆柱
    const clipId = 'st-clip-' + name;
    el('clipPath', { id: clipId }, defs).appendChild(el('path', { d }));
    const inner = el('g', { 'clip-path': `url(#${clipId})` }, g);
    el('ellipse', { cx: CX, cy: y0, rx: hw(y0), ry: hw(y0) * RYK, fill: top }, g);
    return inner;
  }

  function build() {
    stage = document.getElementById('storySvgBox');
    storyEl = document.getElementById('story');
    lineupEl = document.getElementById('lineup');
    row = document.getElementById('lineupRow');
    stage.innerHTML = '';
    svg = el('svg', { viewBox: vb.join(' '), class: 'story-svg', 'aria-hidden': 'true' });
    stage.appendChild(svg);
    const defs = el('defs', {}, svg);

    // 圆柱的明暗
    const shade = el('linearGradient', { id: 'st-shade', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    [[0, '#000', 0.28], [0.22, '#fff', 0.16], [0.4, '#fff', 0.04], [0.75, '#000', 0.06], [1, '#000', 0.34]]
      .forEach(([o, c, a]) => el('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, shade));
    const grad = (id, cols) => {
      const g = el('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      return cols.map((c, i) => el('stop', { offset: i / (cols.length - 1), 'stop-color': c }, g));
    };
    teaStops = grad('st-tea', ['#E4D58A', '#A88F33']);
    milkStops = grad('st-milk', ['#F4E9D8', '#E2CDB0']);
    grad('st-foam', ['#FFFDF6', '#F1D9A2']);
    grad('st-pearlbed', ['#6B3A16', '#2A1206']);
    const pearl = el('radialGradient', { id: 'st-pearl', cx: '35%', cy: '30%', r: '75%' }, defs);
    el('stop', { offset: 0, 'stop-color': '#7A4A2A' }, pearl);
    el('stop', { offset: 1, 'stop-color': '#120806' }, pearl);
    const shadow = el('radialGradient', { id: 'st-shadow' }, defs);
    el('stop', { offset: 0, 'stop-color': '#000', 'stop-opacity': 0.45 }, shadow);
    el('stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': 0 }, shadow);

    floor = el('ellipse', { cx: CX, cy: RIM + CUP_H + 34, rx: 130, ry: 18, fill: 'url(#st-shadow)', class: 'st-floor' }, svg);
    cupG = el('g', { class: 'st-cup' }, svg);
    leaderGs = []; layerGs = [];

    // 先画最下面的层，上面的层盖住下面的
    const order = [...LAYERS].reverse();
    const made = {};
    order.forEach(([name, a, b]) => {
      const g = el('g', { class: 'st-layer' }, cupG);
      const y0 = RIM + a, y1 = RIM + b;
      if (name === 'pearls') {
        const inner = slice(g, name, y0, y1, 'url(#st-pearlbed)', '#5A2C10', defs);
        const r = rng(11);
        for (let row = 0; row < 4; row++) {
          for (let k = 0; k < 9; k++) {
            const y = y0 + 16 + row * 17 + r() * 4;
            const x = CX - hw(y - RIM) + 14 + k * 23 + (row % 2) * 11 + r() * 4;
            pearlAt(inner, x, y, 10.5);
          }
        }
        // 液面上露出来的珍珠
        for (let k = 0; k < 11; k++) {
          const ang = r() * Math.PI * 2, rr = Math.sqrt(r()) * 0.82;
          pearlAt(g, CX + Math.cos(ang) * hw(a) * rr, y0 + Math.sin(ang) * hw(a) * RYK * rr, 7.5);
        }
      } else if (name === 'milk') {
        const inner = slice(g, name, y0, y1, 'url(#st-milk)', '#FBF3EA', defs);
        // 奶倒进茶里的"云"
        [[-50, 0.3], [10, 0.55], [60, 0.25]].forEach(([dx, op]) => el('path', {
          d: `M${CX + dx - 40} ${y0 + 10} q20 30 50 18 t40 30`, stroke: '#fff', 'stroke-width': 10, fill: 'none', opacity: op, 'stroke-linecap': 'round',
        }, inner));
      } else if (name === 'tea') {
        const inner = slice(g, name, y0, y1, 'url(#st-tea)', '#F2E6B0', defs);
        el('path', { d: `M${CX - 90} ${y0 + 40} L${CX - 74} ${y1 - 6}`, stroke: '#fff', 'stroke-width': 9, opacity: 0.3, 'stroke-linecap': 'round' }, inner);
      } else if (name === 'ice') {
        const inner = slice(g, name, y0, y1, 'rgba(225,238,255,.42)', 'rgba(240,248,255,.75)', defs);
        [[-60, 22, -12], [-6, 26, 9], [46, 18, -5]].forEach(([dx, dy, rot]) => cube(inner, CX + dx, y0 + dy, rot, 30));
        [[-34, -6, 14], [30, -4, -10]].forEach(([dx, dy, rot]) => cube(g, CX + dx, y0 + dy, rot, 26));
      } else if (name === 'foam') {
        slice(g, name, y0, y1, 'url(#st-foam)', '#FFFDF4', defs);
        const r = rng(5);
        for (let k = 0; k < 14; k++) {
          const ang = r() * Math.PI * 2, rr = Math.sqrt(r()) * 0.85;
          el('circle', { cx: CX + Math.cos(ang) * hw(a) * rr, cy: y0 + Math.sin(ang) * hw(a) * RYK * rr, r: 1.5 + r() * 2.5, fill: '#fff', opacity: 0.9 }, g);
        }
      } else if (name === 'lid') {
        // 吸管 + 杯口的圈
        const straw = el('g', { transform: `rotate(10 ${CX + 30} ${y0})` }, g);
        el('rect', { x: CX + 22, y: y0 - 108, width: 22, height: 128, rx: 10, fill: '#F2A7B8' }, straw);
        el('rect', { x: CX + 26, y: y0 - 108, width: 6, height: 128, rx: 3, fill: '#fff', opacity: 0.4 }, straw);
        el('ellipse', { cx: CX, cy: y0 + 8, rx: HW0 + 8, ry: (HW0 + 8) * RYK, fill: 'none', stroke: '#E9DDF7', 'stroke-width': 12 }, g);
        el('ellipse', { cx: CX, cy: y0 + 8, rx: HW0 + 8, ry: (HW0 + 8) * RYK, fill: 'none', stroke: '#fff', 'stroke-width': 2, opacity: 0.7, transform: 'translate(0 -3)' }, g);
      }
      made[name] = g;
    });
    // 按从上到下的顺序存
    layerGs = LAYERS.map(([name]) => made[name]);

    // 玻璃杯外壳：合起来的时候才看得到
    glass = el('g', { class: 'st-glass' }, cupG);
    const a = HW0 + 6, b = HW1 + 6, y0 = RIM - 4, y1 = RIM + CUP_H + 4;
    el('path', { d: `M${CX - a} ${y0} L${CX - b} ${y1} A${b} ${b * RYK} 0 0 0 ${CX + b} ${y1} L${CX + a} ${y0}`, fill: 'none', stroke: '#fff', 'stroke-width': 2.5, opacity: 0.55 }, glass);
    el('path', { d: `M${CX - a + 14} ${y0 + 30} L${CX - b + 10} ${y1 - 30}`, stroke: '#fff', 'stroke-width': 8, 'stroke-linecap': 'round', opacity: 0.22 }, glass);

    // 说明的引线
    LAYERS.forEach(([name, a2, b2], i) => {
      const lg = el('g', { class: 'st-leader' }, svg);
      const midY = RIM + (a2 + b2) / 2;
      const x0 = CX + hw((a2 + b2) / 2) + 10;
      el('circle', { cx: x0, cy: midY, r: 4, fill: '#fff' }, lg);
      el('path', { d: `M${x0} ${midY} L${LX - 6} ${midY}`, stroke: '#fff', 'stroke-width': 1.5, opacity: 0.7, 'stroke-dasharray': '3 4' }, lg);
      lg.dataset.y = midY;
      leaderGs.push(lg);
    });

    renderText();
    buildLineup();
    built = true;
    update();
  }

  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function pearlAt(g, x, y, r) {
    el('circle', { cx: x, cy: y, r, fill: 'url(#st-pearl)' }, g);
    el('ellipse', { cx: x - r * 0.35, cy: y - r * 0.4, rx: r * 0.3, ry: r * 0.2, fill: '#fff', opacity: 0.45 }, g);
  }
  function cube(g, x, y, rot, s) {
    const c = el('g', { transform: `rotate(${rot} ${x} ${y})` }, g);
    el('rect', { x: x - s / 2, y: y - s / 2, width: s, height: s, rx: 7, fill: '#fff', opacity: 0.45, stroke: '#fff', 'stroke-width': 1.5 }, c);
    el('path', { d: `M${x - s / 2 + 6} ${y - s / 2 + 8} l10 -2`, stroke: '#fff', 'stroke-width': 3, 'stroke-linecap': 'round' }, c);
  }

  /* 文字：说明标签、茶底列表（语言切换、菜单变化时重画） */
  function renderText() {
    const box = document.getElementById('storyLabels');
    teas = MENU.teas.filter(x => x.available !== false);
    box.innerHTML = LAYERS.map(([name]) =>
      `<div class="st-label"><b>${t('story.l.' + name)}</b><span>${t('story.l.' + name + 'D', { n: teas.length })}</span></div>`).join('');
    labels = [...box.children];
    document.getElementById('storyDots').innerHTML = teas.map(() => '<i></i>').join('');
    flavorIdx = -1;
    document.querySelectorAll('#story [data-i18n], #lineup [data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  }

  function setFlavor(i) {
    if (i === flavorIdx || !teas.length) return;
    flavorIdx = i;
    const tea = teas[i];
    teaStops[0].setAttribute('stop-color', tea.top);
    teaStops[1].setAttribute('stop-color', tea.bottom);
    milkStops[0].setAttribute('stop-color', Cup.mix(tea.top, '#FBF3EA', 0.55));
    milkStops[1].setAttribute('stop-color', Cup.mix(tea.bottom, '#EAD6C2', 0.45));
    storyEl.style.setProperty('--tea1', tea.top);
    storyEl.style.setProperty('--tea2', tea.bottom);
    const name = document.getElementById('storyBase');
    name.textContent = L(tea.name);
    name.classList.remove('pop'); void name.offsetWidth; name.classList.add('pop');
    document.getElementById('storyBaseMeta').textContent =
      `${t('caf.' + (tea.caffeine || 'mid'))} · ${t('story.from', { p: money(Pricing.cents(tea.price)) })}`;
    document.getElementById('storyBaseGo').href = '#/diy?' + toQuery({ ...defaultRecipe(), tea: tea.id });
    [...document.getElementById('storyDots').children].forEach((d, k) => d.classList.toggle('on', k === i));
  }

  /* 招牌饮品一排 */
  function buildLineup() {
    row.innerHTML = '';
    activeDrinks().forEach((d, i) => {
      const ok = Pricing.checkRecipe(d.preset, MENU, CFG.features.maxToppings || 3).ok;
      const card = document.createElement('article');
      card.className = 'lu-card' + (ok ? '' : ' is-soldout');
      card.innerHTML = `
        <a class="lu-cup" href="#/diy?${toQuery(d.preset)}" aria-label="${esc(L(d.name))}">
          ${d.badge ? `<span class="badge-tag ${d.badge}">${t('badge.' + d.badge)}</span>` : ''}
        </a>
        <h3>${esc(L(d.name))}</h3>
        <p>${esc(L(d.desc))}</p>
        <div class="lu-foot"><span>${money(unitCents(d.preset, d.id))}</span>
          <button class="btn btn-sm" ${ok ? '' : 'disabled'}>${ok ? t('menu.add') : t('soldoutToday')}</button></div>`;
      const c = Cup.create(card.querySelector('.lu-cup'), { size: 'sm', seed: 300 + i });
      c.update(d.preset);
      c.svg.setAttribute('aria-hidden', 'true');
      card.querySelector('button').addEventListener('click', () => addToCart(d.preset, d.id));
      row.appendChild(card);
    });
    const cta = document.createElement('a');
    cta.className = 'lu-cta';
    cta.href = '#/diy';
    cta.innerHTML = `<strong>${t('story.build')}</strong><span aria-hidden="true">→</span>`;
    row.appendChild(cta);
  }

  /* 每一帧：根据滚动位置摆好所有东西 */
  function progress(sec) {
    const r = sec.getBoundingClientRect();
    const total = r.height - innerHeight;
    return total > 0 ? clamp(-r.top / total) : 0;
  }

  function update() {
    ticking = false;
    if (!built || document.getElementById('view-home').hidden || storyEl.hidden) return;
    const still = storyEl.classList.contains('is-static');
    const p = still ? 0.3 : progress(storyEl);

    // 时间线：0–.12 开场 · .12–.40 拆开 · .40–.50 停一下 · .50–.58 合回去 · .58–1 换茶底
    const explode = still ? 1 : ease(span(p, 0.12, 0.38)) * (1 - ease(span(p, 0.5, 0.6)));
    const intro = ease(span(p, 0, 0.1));
    const chapter = still ? 1 : p < 0.12 ? 0 : p < 0.55 ? 1 : 2;
    storyEl.dataset.chapter = chapter;
    storyEl.classList.toggle('base-glow', chapter === 2);
    // 屏幕宽窄变了，换一个看得到的范围
    const want = innerWidth <= 760 ? VB_NARROW : VB_WIDE;
    if (want !== vb) { vb = want; svg.setAttribute('viewBox', vb.join(' ')); }

    // 整个杯子：开场时从下面浮上来，换茶底时往右挪一点、慢慢转
    const toBase = ease(span(p, 0.52, 0.62));
    const bob = still ? 0 : Math.sin(p * 40) * 3 * (1 - explode);
    const s = 0.88 + 0.12 * intro;
    // 手机上：拆开时杯子靠左给说明腾位置，其余时候居中
    const narrow = vb === VB_NARROW;
    const shiftX = narrow ? 110 * (1 - explode) : toBase * 30;
    cupG.setAttribute('transform', `translate(${shiftX} ${(1 - intro) * 40 + bob}) translate(${CX} ${RIM + 150}) scale(${s}) translate(${-CX} ${-(RIM + 150)})`);
    glass.style.opacity = clamp(1 - explode * 2);

    const n = LAYERS.length;
    // 影子跟着最下面那层走
    floor.setAttribute('transform', `translate(${shiftX} ${(n - 1) / 2 * GAP * explode * s + (1 - intro) * 40})`);
    floor.style.opacity = 1 - explode * 0.4;
    layerGs.forEach((g, i) => {
      const off = (i - (n - 1) / 2) * GAP * explode;
      const tilt = (i % 2 ? 1 : -1) * 2.5 * explode;
      g.setAttribute('transform', `translate(0 ${off}) rotate(${tilt} ${CX} ${RIM + LAYERS[i][1]})`);
    });

    // 引线和说明：一层一层出现
    const svgRect = svg.getBoundingClientRect();
    const boxRect = stage.getBoundingClientRect();
    const k = Math.min(svgRect.width / vb[2], svgRect.height / vb[3]);
    const ox = svgRect.left + (svgRect.width - vb[2] * k) / 2 - boxRect.left - vb[0] * k;
    const oy = svgRect.top + (svgRect.height - vb[3] * k) / 2 - boxRect.top - vb[1] * k;
    leaderGs.forEach((lg, i) => {
      const show = still ? 1 : clamp((explode - 0.55 - i * 0.06) / 0.2) * (chapter === 1 ? 1 : 0);
      const off = (i - (n - 1) / 2) * GAP * explode;
      // 引线跟着杯子一起缩放、移动
      const y = Number(lg.dataset.y) + off;
      const cyC = RIM + 150;
      const ys = (y - cyC) * s + cyC + (1 - intro) * 40 + bob;
      lg.setAttribute('transform', `translate(0 ${ys - Number(lg.dataset.y)})`);
      lg.style.opacity = show;
      const lab = labels[i];
      lab.style.opacity = show;
      lab.style.transform = `translate(${ox + LX * k}px, ${oy + ys * k}px) translateY(-50%) translateX(${(1 - show) * 16}px)`;
    });

    // 换茶底
    if (chapter === 2 && teas.length) {
      const q = span(p, 0.6, 0.98);
      setFlavor(Math.min(teas.length - 1, Math.floor(q * teas.length)));
    } else if (flavorIdx !== 0 && teas.length) {
      setFlavor(0);
    }

    // 招牌一排横着滑
    if (!lineupEl.classList.contains('is-static')) {
      const lp = progress(lineupEl);
      const maxShift = Math.max(0, row.scrollWidth - row.parentElement.clientWidth);
      row.style.transform = `translateX(${-ease(span(lp, 0.08, 0.92)) * maxShift}px)`;
      lineupEl.style.setProperty('--lp', lp.toFixed(3));
    }

    // 右边的小导航
    const nav = document.getElementById('storyNav');
    const lineupOn = lineupEl.getBoundingClientRect().top < innerHeight * 0.5;
    [...nav.children].forEach((b, idx) => b.classList.toggle('on', lineupOn ? idx === 3 : idx === chapter));
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }

  function jump(idx) {
    const target = idx === 3 ? lineupEl : storyEl;
    const top = target.getBoundingClientRect().top + scrollY;
    const total = storyEl.offsetHeight - innerHeight;
    const at = idx === 3 ? top : top + [0, 0.3, 0.62][idx] * total;
    scrollTo({ top: at, behavior: 'smooth' });
  }

  function setup() {
    const st = matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      document.getElementById('story').classList.toggle('is-static', st.matches);
      document.getElementById('lineup').classList.toggle('is-static', st.matches);
    };
    apply();
    st.addEventListener?.('change', () => { apply(); onScroll(); });
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    document.getElementById('storyNav').addEventListener('click', e => {
      const b = e.target.closest('button[data-i]');
      if (b) jump(Number(b.dataset.i));
    });
  }

  return {
    setup,
    rebuild() { if (!built) build(); else { renderText(); buildLineup(); update(); } },
    update: onScroll,
  };
})();
