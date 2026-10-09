/* =========================================================
   cup.js：画杯子
   用法：
     const cup = Cup.create(容器元素, { size: 'lg' 或 'sm', seed: 数字 });
     cup.update(配方);   // 配方变了就调用，它只重画变化的部分

   杯子是一个梯形（SVG 坐标，viewBox 0 0 240 360）：
     杯口 y=70，半宽 88；杯底 y=318，半宽 68。
   ========================================================= */

const Cup = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const CX = 120;              // 杯子中心线
  const LIQUID_TOP = 100;      // 液面高度
  const FLOOR = 326;           // 杯底（小料能落到的最低点）
  const FLOAT_ZONE = [140, 250];
  const halfWidth = y => 88 - (y - 70) * (20 / 248);
  const CUP_PATH = 'M32 70 L208 70 L188 318 Q186 334 170 334 L70 334 Q54 334 52 318 Z';

  let instanceCount = 0;
  // 菜单从服务器读取，启动后由 script.js 调用 Cup.setMenu(菜单) 设置进来
  let MENU = null;
  const menu = () => MENU;
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 小工具 ---------- */
  function el(tag, attrs = {}, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // 两个颜色按比例 t 混合
  function mix(a, b, t) {
    t = Math.max(0, Math.min(1, t));
    const pa = a.match(/\w\w/g).map(h => parseInt(h, 16));
    const pb = b.match(/\w\w/g).map(h => parseInt(h, 16));
    return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }

  // 可以设定种子的随机数：同一个种子每次生成的结果都一样，
  // 菜单里的小杯子就不会每次刷新都长得不一样。
  function seededRandom(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 液体颜色：茶底渐变 + 奶 + 糖 ---------- */
  function liquidColors(recipe) {
    const tea = menu().teas.find(t => t.id === recipe.tea) || menu().teas[0];
    const milk = menu().milks.find(m => m.id === recipe.milk) || menu().milks[0];
    let top = mix(tea.top, '#FBF3EA', milk.mix * 1.1);
    let mid = mix(mix(tea.top, tea.bottom, 0.5), '#F6EADC', milk.mix * 0.85);
    let bottom = mix(tea.bottom, '#EAD6C2', milk.mix * 0.55);
    const warm = (recipe.sweet || 0) / 1400;          // 糖越多颜色越暖一点点
    top = mix(top, '#D08A45', warm);
    mid = mix(mid, '#C27A3A', warm);
    if (recipe.tops.includes('brown')) bottom = mix(bottom, '#4A2008', 0.35);
    return { top, mid, bottom };
  }

  /* ---------- 小料的形状（以 0,0 为中心） ---------- */
  function drawPiece(g, t, p, gid) {
    if (t.id === 'pearl' || t.id === 'brown') {
      el('circle', { r: t.r, fill: `url(#${gid}-${t.id})` }, g);
      el('ellipse', { cx: -t.r * 0.35, cy: -t.r * 0.4, rx: t.r * 0.32, ry: t.r * 0.22, fill: '#fff', opacity: 0.45 }, g);
    } else if (t.id === 'taroball') {
      el('ellipse', { rx: t.r * 1.15, ry: t.r * 0.85, fill: `url(#${gid}-${t.id})`, transform: `rotate(${p.rot})` }, g);
      el('ellipse', { cx: -t.r * 0.4, cy: -t.r * 0.35, rx: t.r * 0.35, ry: t.r * 0.2, fill: '#fff', opacity: 0.5 }, g);
    } else if (t.id === 'coco') {
      const s = t.r * 1.8;
      el('rect', { x: -s / 2, y: -s / 2, width: s, height: s, rx: 3, fill: `url(#${gid}-${t.id})`,
        opacity: 0.85, stroke: '#fff', 'stroke-opacity': 0.7, 'stroke-width': 1, transform: `rotate(${p.rot})` }, g);
      el('rect', { x: -s / 2 + 2, y: -s / 2 + 2, width: s * 0.35, height: s * 0.2, rx: 1.5, fill: '#fff', opacity: 0.8,
        transform: `rotate(${p.rot})` }, g);
    } else if (t.id === 'pudding') {
      // 梯形布丁 + 顶上一层焦糖
      el('path', { d: 'M-17 -14 L17 -14 L24 18 Q24 22 20 22 L-20 22 Q-24 22 -24 18 Z', fill: `url(#${gid}-${t.id})` }, g);
      el('path', { d: 'M-17 -14 L17 -14 L18.5 -7 Q0 -3 -18.5 -7 Z', fill: '#9A5A26' }, g);
      el('ellipse', { cx: -9, cy: 2, rx: 4, ry: 9, fill: '#fff', opacity: 0.35 }, g);
    }
  }

  /* ---------- 小料怎么摆：像真的一样一颗颗落下去堆起来 ----------
     对每一颗新珍珠，随机试几个 x 位置，算出它从上面掉下来会停在哪
     （碰到杯底或者碰到别的珍珠就停），选停得最低的那个位置。
     这样珍珠会自然地堆起来，又不会互相重叠。 */
  function restingY(x, r, placed) {
    let y = FLOOR - r;
    for (const c of placed) {
      const dx = x - c.x;
      const minD = r + c.r - 1;            // 允许 1 个单位的轻微贴合，看起来更紧凑
      if (Math.abs(dx) < minD) {
        y = Math.min(y, c.y - Math.sqrt(minD * minD - dx * dx));
      }
    }
    return y;
  }

  function dropPosition(r, placed, rand) {
    let best = null;
    for (let i = 0; i < 14; i++) {
      let x = CX + (rand() * 2 - 1) * (halfWidth(FLOOR) - r - 4);
      let y = restingY(x, r, placed);
      // 越往上杯子越宽；越往下越窄。确保不会卡到杯壁外面
      const limit = halfWidth(y) - r - 4;
      if (Math.abs(x - CX) > limit) { x = CX + Math.sign(x - CX) * limit; y = restingY(x, r, placed); }
      if (y < LIQUID_TOP + r + 10) continue;               // 太满了，别冒出液面
      if (!best || y > best.y + rand() * 3) best = { x, y };
    }
    return best;
  }

  function floatPosition(r, placed, rand) {
    for (let i = 0; i < 40; i++) {
      const y = FLOAT_ZONE[0] + rand() * (FLOAT_ZONE[1] - FLOAT_ZONE[0]);
      const x = CX + (rand() * 2 - 1) * (halfWidth(y) - r - 8);
      if (placed.every(c => Math.hypot(c.x - x, c.y - y) > c.r + r + 3)) return { x, y };
    }
    return null;
  }

  /* ---------- 创建一个杯子 ---------- */
  function create(container, opts = {}) {
    const id = 'cup' + (++instanceCount);
    const small = opts.size === 'sm';
    const rand = opts.seed != null ? seededRandom(opts.seed) : Math.random;
    const animate = !small && !opts.still;

    const svg = el('svg', { viewBox: '0 0 240 380', class: 'cup' + (small ? ' cup-sm' : ''), role: 'img' });
    container.appendChild(svg);

    const defs = el('defs', {}, svg);
    el('clipPath', { id: `${id}-clip` }, defs).appendChild(el('path', { d: CUP_PATH }));

    // 液体的渐变：从上到下三个颜色
    const lg = el('linearGradient', { id: `${id}-liquid`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    const stops = [0, 0.45, 1].map(o => el('stop', { offset: o }, lg));
    // 液面那一层波浪用的颜色
    const waveGrad = el('linearGradient', { id: `${id}-wave`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    const waveStops = [0, 1].map(o => el('stop', { offset: o }, waveGrad));

    // 每种小料一个"球面"渐变，左上角亮、右下角暗，看起来是立体的。
    // 用到哪种才创建哪种（店员后台可能新加了小料）
    function ensureGradient(t) {
      const gid = `${id}-${t.id}`;
      let rg = defs.querySelector(`#${CSS.escape(gid)}`);
      if (!rg) {
        rg = el('radialGradient', { id: gid, cx: '35%', cy: '30%', r: '75%' }, defs);
        el('stop', { offset: 0 }, rg);
        el('stop', { offset: 1 }, rg);
      }
      rg.children[0].setAttribute('stop-color', t.light);
      rg.children[1].setAttribute('stop-color', t.dark);
    }
    // 黑糖挂壁的渐变：上面浓，往下慢慢变淡
    const syrup = el('linearGradient', { id: `${id}-syrup`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': '#3A1604', 'stop-opacity': 0.85 }, syrup);
    el('stop', { offset: 1, 'stop-color': '#5B2E10', 'stop-opacity': 0 }, syrup);
    // 奶盖渐变
    const foamG = el('linearGradient', { id: `${id}-foam`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': '#FFFDF6' }, foamG);
    el('stop', { offset: 1, 'stop-color': '#F1D9A2' }, foamG);
    // 杯子底下的影子
    const shadowG = el('radialGradient', { id: `${id}-shadow` }, defs);
    el('stop', { offset: 0, 'stop-color': '#2B1D3F', 'stop-opacity': 0.25 }, shadowG);
    el('stop', { offset: 1, 'stop-color': '#2B1D3F', 'stop-opacity': 0 }, shadowG);

    // ----- 图层，从下往上画 -----
    el('ellipse', { cx: CX, cy: 348, rx: 92, ry: 12, fill: `url(#${id}-shadow)` }, svg);

    const steam = el('g', { class: 'steam' }, svg);
    [95, 120, 145].forEach(x => el('path', { d: `M${x} 44 q-8 -10 0 -20 q8 -10 0 -20` }, steam));

    // 吸管先画，液体半透明地盖在它上面，就像透过奶茶看到吸管
    const straw = el('g', { transform: 'rotate(12 146 110)' }, svg);
    el('rect', { x: 138, y: -14, width: 16, height: 250, rx: 7, fill: '#F2A7B8' }, straw);
    el('rect', { x: 141, y: -14, width: 4, height: 250, rx: 2, fill: '#fff', opacity: 0.35 }, straw);

    const inside = el('g', { 'clip-path': `url(#${id}-clip)` }, svg);
    el('rect', { x: 0, y: 60, width: 240, height: 290, fill: '#FFFFFF', opacity: 0.55 }, inside);

    const liquid = el('g', { opacity: 0.94 }, inside);
    el('rect', { x: 0, y: LIQUID_TOP + 4, width: 240, height: 260, fill: `url(#${id}-liquid)` }, liquid);
    // 液面的波浪：一条比杯子宽很多的波浪线，左右来回移动
    let wd = `M-240 ${LIQUID_TOP + 10}`;
    for (let x = -240; x < 480; x += 60) wd += ` q15 -7 30 0 t30 0`;
    wd += ' L480 130 L-240 130 Z';
    const wave = el('path', { d: wd, fill: `url(#${id}-wave)`, class: animate ? 'wave' : '' }, liquid);

    const stripes = el('g', {}, inside);       // 黑糖虎纹
    const ripples = el('g', {}, inside);       // 小料落水时的水波
    const bottomG = el('g', {}, inside);       // 沉底的小料
    const floatG = el('g', {}, inside);        // 悬浮的小料
    const iceG = el('g', {}, inside);          // 冰块
    const foam = el('g', { class: 'foam' }, inside);  // 奶盖

    // 杯子玻璃的高光，让杯子有立体感
    el('path', { d: 'M46 86 L58 300', stroke: '#fff', 'stroke-width': 7, 'stroke-linecap': 'round', opacity: 0.4 }, svg);
    el('path', { d: 'M62 86 L70 210', stroke: '#fff', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.3 }, svg);
    el('path', { d: CUP_PATH, fill: 'none', stroke: '#2B1D3F', 'stroke-width': 4, 'stroke-linejoin': 'round' }, svg);
    el('rect', { x: 24, y: 60, width: 192, height: 14, rx: 7, fill: '#2B1D3F' }, svg);

    // 记录每种小料现在画了哪些颗，加减小料时只处理变化的部分
    const pieces = {};      // 小料 id -> [{x, y, r, rot, node}]
    let current = null;

    /* 沉底小料重新"落定"：去掉某种小料后，上面的会掉下来填补空位 */
    function settle() {
      const all = [];
      Object.values(pieces).forEach(list => list.forEach(p => { if (p.zone === 'bottom') all.push(p); }));
      all.sort((a, b) => b.y - a.y);          // 先处理最低的
      const placed = [];
      all.forEach(p => {
        const ny = restingY(p.x, p.r, placed);
        if (Math.abs(ny - p.y) > 0.5) {
          const dy = p.y - ny;
          p.y = ny;
          p.node.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
          if (animate && !reduceMotion()) {
            p.node.firstChild.animate(
              [{ transform: `translate(0px, ${dy}px)` }, { transform: 'translate(0px, 0px)' }],
              { duration: 500, easing: 'cubic-bezier(.5,0,.5,1.3)' });
          }
        }
        placed.push(p);
      });
    }

    function ripple(delay) {
      if (!animate || reduceMotion()) return;
      const e = el('ellipse', { cx: CX + (rand() - 0.5) * 60, cy: LIQUID_TOP + 8, rx: 6, ry: 2, fill: 'none',
        stroke: '#fff', 'stroke-width': 2, opacity: 0 }, ripples);
      e.style.transformBox = 'fill-box';
      e.style.transformOrigin = 'center';
      e.animate([
        { opacity: 0.8, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(6, 3)' },
      ], { duration: 700, delay, easing: 'ease-out', fill: 'both' }).onfinish = () => e.remove();
    }

    function addTopping(t) {
      const placedBottom = [];
      const placedFloat = [];
      Object.values(pieces).forEach(list => list.forEach(p => (p.zone === 'bottom' ? placedBottom : placedFloat).push(p)));
      ensureGradient(t);
      const list = [];
      const group = t.zone === 'bottom' ? bottomG : floatG;
      for (let i = 0; i < t.count; i++) {
        const pos = t.zone === 'bottom' ? dropPosition(t.r, placedBottom, rand) : floatPosition(t.r, placedFloat.concat(placedBottom), rand);
        if (!pos) continue;
        const p = { x: pos.x, y: pos.y, r: t.r, zone: t.zone, rot: Math.round((rand() - 0.5) * 50) };
        p.node = el('g', { transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})` }, group);
        const inner = el('g', {}, p.node);
        drawPiece(inner, t, p, id);
        (t.zone === 'bottom' ? placedBottom : placedFloat).push(p);
        list.push(p);

        if (animate && !reduceMotion()) {
          // 掉落动画：像受重力一样加速落下，落地时压扁一下再弹起来
          const h = p.y + 40;
          const delay = i * 45;
          inner.style.transformBox = 'fill-box';
          inner.style.transformOrigin = '50% 100%';
          inner.animate([
            { transform: `translate(0px, ${-h}px) rotate(${-p.rot}deg)`, easing: 'cubic-bezier(.5,0,1,.6)' },
            { transform: `translate(0px, ${-(p.y - LIQUID_TOP)}px)`, offset: 0.3, easing: 'cubic-bezier(.2,.6,.6,1)' },
            { transform: 'translate(0px, 0px) scale(1.18, .8)', offset: 0.72, easing: 'ease-out' },
            { transform: 'translate(0px, -6px) scale(.94, 1.06)', offset: 0.85, easing: 'ease-in' },
            { transform: 'translate(0px, 0px) scale(1, 1)' },
          ], { duration: t.zone === 'float' ? 1100 : 900, delay, fill: 'backwards' });
          if (i % 4 === 0) {
            ripple(delay + 250);
            if (opts.onLand) setTimeout(opts.onLand, delay + 260);
          }
        }
      }
      pieces[t.id] = list;
    }

    function removeTopping(tid) {
      (pieces[tid] || []).forEach(p => {
        if (animate && !reduceMotion()) {
          p.node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250 }).onfinish = () => p.node.remove();
        } else p.node.remove();
      });
      delete pieces[tid];
      settle();
    }

    function drawStripes(on) {
      stripes.innerHTML = '';
      if (!on) return;
      // 黑糖挂壁：糖浆从杯口沿着杯壁往下流，越往下越细、越淡。
      // 每条的位置、粗细、长度、弯曲程度都不一样，看起来才自然。
      const r = seededRandom(7);
      const drips = [
        // [起点 x 在杯口的比例, 粗细, 长度]
        [0.06, 16, 190], [0.17, 9, 120], [0.3, 13, 160], [0.47, 7, 85],
        [0.62, 14, 175], [0.78, 9, 130], [0.92, 17, 200],
      ];
      drips.forEach(([fx, w0, len]) => {
        const y0 = LIQUID_TOP + 2;
        const x0 = CX - halfWidth(y0) + fx * halfWidth(y0) * 2;
        const w = w0 * (0.8 + r() * 0.4);
        const L = len * (0.8 + r() * 0.35);
        // 靠近杯壁的糖浆跟着杯壁往里斜；中间的随机弯一点
        const lean = (x0 - CX) * -0.12 + (r() - 0.5) * 14;
        const xe = x0 + lean;                          // 末端（尖）的位置
        const c1 = (r() - 0.5) * 18, c2 = (r() - 0.5) * 18;
        el('path', {
          d: `M${x0 - w / 2} ${y0}
              C ${x0 - w / 2 + c1} ${y0 + L * 0.35}, ${xe - w * 0.25 + c2} ${y0 + L * 0.7}, ${xe} ${y0 + L}
              C ${xe + w * 0.25 + c2} ${y0 + L * 0.7}, ${x0 + w / 2 + c1} ${y0 + L * 0.35}, ${x0 + w / 2} ${y0} Z`,
          fill: `url(#${id}-syrup)`,
          opacity: (0.55 + r() * 0.4).toFixed(2),
        }, stripes);
      });
    }

    function drawIce(cubes) {
      iceG.innerHTML = '';
      const spots = [[78, 112, -14], [128, 106, 10], [158, 128, -6], [98, 138, 16]];
      for (let i = 0; i < cubes; i++) {
        const [x, y, rot] = spots[i];
        const g = el('g', { transform: `rotate(${rot} ${x + 15} ${y + 15})` }, iceG);
        el('rect', { x, y, width: 30, height: 30, rx: 7, fill: '#FFFFFF', opacity: 0.38, stroke: '#fff', 'stroke-opacity': 0.8, 'stroke-width': 1.5 }, g);
        el('path', { d: `M${x + 6} ${y + 8} L${x + 16} ${y + 6}`, stroke: '#fff', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.85 }, g);
      }
    }

    function drawFoam(on) {
      foam.innerHTML = '';
      if (!on) return;
      let d = 'M0 70 L240 70 L240 118';
      for (let x = 240; x > 0; x -= 30) d += ` q-7.5 7 -15 0 t-15 0`;
      d += ' Z';
      el('path', { d, fill: `url(#${id}-foam)` }, foam);
      const r = seededRandom(3);
      for (let i = 0; i < 9; i++) {
        el('circle', { cx: 50 + r() * 140, cy: 86 + r() * 24, r: 1.5 + r() * 2.5, fill: '#fff', opacity: 0.7 }, foam);
      }
      if (animate && !reduceMotion()) {
        foam.animate([{ transform: 'translateY(-40px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
          { duration: 600, easing: 'cubic-bezier(.2,.8,.3,1.2)' });
      }
    }

    /* 对外接口：配方变了就调用 update */
    function update(recipe) {
      const c = liquidColors(recipe);
      [c.top, c.mid, c.bottom].forEach((col, i) => { stops[i].style.stopColor = col; });
      waveStops[0].style.stopColor = mix(c.top, '#FFFFFF', 0.15);
      waveStops[1].style.stopColor = c.top;

      const prevTops = current ? current.tops : [];
      prevTops.filter(t => !recipe.tops.includes(t)).forEach(removeTopping);
      recipe.tops.filter(t => !prevTops.includes(t)).forEach(tid => {
        const t = menu().toppings.find(x => x.id === tid);
        if (t && t.zone !== 'top') addTopping(t);
      });

      if (!current || current.tops.includes('brown') !== recipe.tops.includes('brown')) drawStripes(recipe.tops.includes('brown'));
      if (!current || current.ice !== recipe.ice) drawIce((menu().ices.find(i => i.id === recipe.ice) || { cubes: 0 }).cubes);
      if (!current || current.tops.includes('cheese') !== recipe.tops.includes('cheese')) drawFoam(recipe.tops.includes('cheese'));
      steam.classList.toggle('on', recipe.ice === 'hot');
      svg.classList.toggle('is-large', recipe.size === 'L');
      current = { ...recipe, tops: [...recipe.tops] };
    }

    return { update, svg };
  }

  return { create, mix, setMenu: m => { MENU = m; } };
})();
