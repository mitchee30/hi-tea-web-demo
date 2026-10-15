/* =========================================================
   photocup.js：用真实照片做的杯子（替代以前画出来的 SVG 杯子）
   做法：底图是首页视频最后一帧那杯奶茶（media/cup/base.jpg）。
   按配方逐个像素"重新上色"：保留照片原来的明暗、纹理、高光，只把颜色换成选中的茶底和奶，
   所以换茶底、换奶、加减珍珠/奶盖，看起来还是一张真照片。
   - 茶底 + 奶：用"渐变映射"——照片越暗的地方用越深的茶色，越亮的地方用奶色
   - 黑糖珍珠：杯壁上的深色糖浆纹保留；不加黑糖时，糖浆纹淡成茶色
   - 珍珠：保留照片里的珍珠；不加时，用上面的奶茶纹理把杯底填满
   - 芋圆：把一部分珍珠染成芋紫色
   - 奶盖：保留照片顶上那层；不加时，顶层变成奶茶
   - 椰果、布丁：照片里没有，用半透明的形状叠上去
   用法和以前的 Cup 一样：PhotoCup.create(容器, { size }) → { update(配方), svg }
   ========================================================= */

const PhotoCup = (() => {
  const SRC = 'media/cup/base.jpg';
  const W = 520, H = 720;               // 底图尺寸
  // 杯子在底图里的位置（像素）
  const RIM = 318, FOAM_END = 378, SWIRL_END = 532, BOTTOM = 676;
  const leftWall = y => 125 + (y - 320) * (35 / 350);
  const rightWall = y => 395 - (y - 320) * (33 / 350);

  let img = null;
  const ready = new Promise(res => {
    img = new Image();
    img.onload = () => res(true);
    img.onerror = () => res(false);
    img.src = SRC;
  });
  const cache = {};                     // 每种分辨率算一次：原图像素 + 每个像素属于哪一层

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
  const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  /* 预先算好：每个像素的亮度、在不在杯子里、属于奶盖/奶茶/珍珠哪一层（边缘做柔和过渡） */
  function prepare(k) {
    if (cache[k]) return cache[k];
    const w = Math.round(W * k), h = Math.round(H * k);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, w, h);
    const data = g.getImageData(0, 0, w, h).data;
    const n = w * h;
    const lum = new Float32Array(n), fw = new Float32Array(n), sw = new Float32Array(n), pw = new Float32Array(n);
    const y0 = Math.floor((RIM - 6) * k), y1 = Math.ceil((BOTTOM + 8) * k);
    for (let py = y0; py < y1; py++) {
      const y = py / k;
      const vin = smooth(RIM - 2, RIM + 4, y) * (1 - smooth(BOTTOM - 6, BOTTOM + 4, y));
      const fW = 1 - smooth(FOAM_END - 8, FOAM_END + 8, y);
      const pW = smooth(SWIRL_END - 10, SWIRL_END + 10, y);
      const sW = 1 - fW - pW;
      const lw = leftWall(y), rw = rightWall(y);
      for (let px = Math.floor(100 * k); px < Math.ceil(420 * k); px++) {
        const x = px / k;
        const hin = smooth(lw, lw + 4, x) * (1 - smooth(rw - 4, rw, x));
        const inside = vin * hin;
        if (inside <= 0) continue;
        const i = py * w + px;
        fw[i] = fW * inside; sw[i] = sW * inside; pw[i] = pW * inside;
      }
    }
    for (let i = 0; i < n; i++) lum[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
    // 找出一颗一颗的珍珠：先把亮度模糊一下，找"周围最暗的点"当每颗珍珠的中心，
    // 再把每个像素分给最近的中心。同时加芋圆和珍珠时，按中心编号把一部分染成芋圆
    const R = Math.max(3, Math.round(7 * k));
    const blur = new Float32Array(n).fill(1);
    const yA = Math.round((SWIRL_END - 6) * k), yB = Math.round((BOTTOM - 20) * k);
    for (let py = yA; py < yB; py++) for (let px = R; px < w - R; px++) {
      const i = py * w + px;
      if (pw[i] < 0.5) continue;
      let sum = 0, cnt = 0;
      for (let dy = -R; dy <= R; dy += 2) for (let dx = -R; dx <= R; dx += 2) { sum += lum[i + dy * w + dx]; cnt++; }
      blur[i] = sum / cnt;
    }
    const centers = [];
    const gap = 15 * k;
    const cand = [];
    for (let py = yA; py < yB; py++) for (let px = R; px < w - R; px++) { const i = py * w + px; if (blur[i] < 0.24) cand.push(i); }
    cand.sort((a, b) => blur[a] - blur[b]);
    for (const i of cand) {
      const x = i % w, y = i / w | 0;
      if (centers.every(c => (c[0] - x) ** 2 + (c[1] - y) ** 2 > gap * gap)) centers.push([x, y]);
    }
    const ballId = new Int32Array(n);
    for (let py = yA - R; py < Math.round(BOTTOM * k); py++) for (let px = 0; px < w; px++) {
      const i = py * w + px;
      if (pw[i] <= 0 || !centers.length) continue;
      let best = 0, bd = Infinity;
      centers.forEach((c, ci) => { const d = (c[0] - px) ** 2 + (c[1] - py) ** 2; if (d < bd) { bd = d; best = ci; } });
      ballId[i] = best + 1;
    }
    return (cache[k] = { w, h, data, lum, fw, sw, pw, y0, y1, ballId });
  }

  /* 根据配方算出这杯的颜色 */
  function palette(r, menu) {
    const tea = menu.teas.find(t => t.id === r.tea) || menu.teas[0];
    const milk = menu.milks.find(m => m.id === r.milk) || menu.milks[0];
    const tops = r.tops || [];
    const top = hex(tea.top), bottom = hex(tea.bottom);
    const cream = r.milk === 'oat' ? hex('#F1E3CC') : hex('#FBF3EA');
    const hasMilk = milk.mix > 0;
    const light = hasMilk ? mix(top, cream, clamp(0.45 + milk.mix)) : mix(top, [255, 255, 255], 0.18);
    const brown = tops.includes('brown');
    const dark = brown ? hex('#4A2410') : mix(bottom, [0, 0, 0], hasMilk ? 0.15 : 0.3);
    const warm = (r.sweet || 0) / 100;
    const Lc = mix(light, hex('#F4D9B0'), warm * 0.08), Mc = mix(dark, light, hasMilk ? 0.5 : 0.35);
    // 跟底图那杯差多少（0 = 一模一样）
    const diff = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const away = clamp((diff(Lc, [236, 228, 218]) + diff(Mc, [154, 98, 54]) * 0.6 + diff(dark, [42, 20, 10]) * 0.4) / 90) * 0.7;
    return {
      away, light: Lc, mid: Mc, dark,
      // 不加黑糖：深色的糖浆纹淡一点；不加奶：整体更通透、更像纯茶
      squeeze: brown ? [0, 1] : hasMilk ? [0.38, 0.62] : [0.22, 0.7],
      foam: tops.includes('cheese'),
      pearls: tops.includes('pearl') || tops.includes('brown'),
      taro: tops.includes('taroball'),
      coco: tops.includes('coco'),
      pudding: tops.includes('pudding'),
    };
  }

  function ramp(l, P) {
    if (l < 0.42) return mix(P.dark, P.mid, l / 0.42);
    return mix(P.mid, P.light, (l - 0.42) / 0.58);
  }
  // 底图那杯（黑糖珍珠鲜奶）本来的颜色：深处是黑糖色，中间焦糖色，亮处奶白。
  // 上色时只加"目标颜色 - 原来颜色"的差值，所以配方一样时就是原照片，细节一点不丢
  const BASE = { dark: hex('#2A140A'), mid: hex('#9A6236'), light: hex('#ECE4DA') };

  /* 逐个像素重新上色 */
  function paint(ctx, k, r, menu) {
    const A = prepare(k), P = palette(r, menu);
    const { w, data, lum, fw, sw, pw } = A;
    const out = ctx.createImageData(w, A.h);
    const o = out.data;
    o.set(data);
    const taroDark = hex('#5B3E8C'), taroLight = hex('#DCC9F3');
    for (let py = A.y0; py < A.y1; py++) {
      for (let px = 0; px < w; px++) {
        const i = py * w + px;
        const inside = fw[i] + sw[i] + pw[i];
        if (inside <= 0) continue;
        const j = i * 4;
        let l = lum[i];
        const orig = [data[j], data[j + 1], data[j + 2]];
        const liquid = (ll, src = orig) => {
          const q = P.squeeze[0] + (P.squeeze[1] - P.squeeze[0]) * ll;
          const want = ramp(q, P), was = ramp(ll, BASE);
          let c = [0, 1, 2].map(n => clamp(src[n] + want[n] - was[n], 0, 255));
          c = mix(c, want, P.away);                                         // 跟原图差得越多，越用目标颜色
          if (ll > 0.9) c = mix(c, src, (ll - 0.9) * 6);                  // 保留水珠、反光
          return c;
        };
        let res = [0, 0, 0];
        // 奶盖层
        if (fw[i] > 0) res = mix(res, [0, 0, 0], 0).map((v, n) => v + (P.foam ? mix(orig, hex('#FFF6E4'), 0.08)[n] : liquid(Math.max(l, 0.55))[n]) * fw[i]);
        // 奶茶层
        if (sw[i] > 0) { const c = liquid(l); res = res.map((v, n) => v + c[n] * sw[i]); }
        // 珍珠层
        if (pw[i] > 0) {
          let c;
          const ball = clamp((0.34 - l) / 0.1);           // 越暗越像珍珠
          const cell = ((A.ballId[i] * 2654435761) >>> 0) % 3 !== 0;   // 大约三分之二染成芋圆
          const showPearl = P.pearls && (!P.taro || !cell);
          const showTaro = P.taro && (!P.pearls || cell);
          if (showPearl || showTaro) {
            const ballCol = showPearl ? orig : mix(taroDark, taroLight, clamp(l / 0.34));
            c = mix(liquid(Math.max(l, 0.35)), ballCol, ball);
          } else {
            // 没有珍珠/芋圆：用上面奶茶层的纹理填满杯底，越往下稍微暗一点
            const sy = Math.max(Math.round((FOAM_END + 8) * k), Math.round(2 * SWIRL_END * k - py));   // 以分界线为轴镜像借纹理，接缝看不出来
            const si = sy * w + px;
            const src = [data[si * 4], data[si * 4 + 1], data[si * 4 + 2]];
            c = mix(liquid(lum[si] ?? l, src), [0, 0, 0], 0.05 + 0.1 * clamp((py / k - SWIRL_END) / (BOTTOM - SWIRL_END)));
          }
          res = res.map((v, n) => v + c[n] * pw[i]);
        }
        for (let n = 0; n < 3; n++) o[j + n] = orig[n] * (1 - inside) + res[n];
      }
    }
    ctx.putImageData(out, 0, 0);
    overlays(ctx, k, P);
  }

  /* 照片里没有的小料：椰果、布丁，用半透明的形状叠上去，限制在杯子里面 */
  function overlays(ctx, k, P) {
    if (!P.coco && !P.pudding) return;
    ctx.save();
    ctx.scale(k, k);
    ctx.beginPath();
    ctx.moveTo(leftWall(RIM), RIM); ctx.lineTo(rightWall(RIM), RIM);
    ctx.lineTo(rightWall(BOTTOM), BOTTOM); ctx.lineTo(leftWall(BOTTOM), BOTTOM);
    ctx.closePath(); ctx.clip();
    ctx.filter = 'blur(0.7px)';
    if (P.coco) {
      const spots = [[180, 420, -12], [262, 446, 8], [330, 410, 18], [214, 492, 24], [300, 500, -8], [160, 470, 4], [352, 470, -16]];
      spots.forEach(([x, y, rot]) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot * Math.PI / 180);
        ctx.fillStyle = 'rgba(255,253,240,.42)'; ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.roundRect(-11, -11, 22, 22, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(-7, -8, 8, 3);
        ctx.restore();
      });
    }
    if (P.pudding) {
      ctx.save(); ctx.translate(300, 612);
      const g = ctx.createLinearGradient(0, -34, 0, 30);
      g.addColorStop(0, '#E9B45A'); g.addColorStop(0.18, '#F7D78A'); g.addColorStop(1, '#D9A443');
      ctx.fillStyle = g; ctx.globalAlpha = 0.92;
      ctx.beginPath(); ctx.moveTo(-30, -30); ctx.lineTo(30, -30); ctx.lineTo(40, 30); ctx.lineTo(-40, 30); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8A4B16'; ctx.beginPath(); ctx.moveTo(-30, -30); ctx.lineTo(30, -30); ctx.lineTo(32, -22); ctx.lineTo(-32, -22); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-20, -14, 6, 30);
      ctx.restore();
    }
    ctx.restore();
  }

  function create(container, opts = {}) {
    const k = opts.size === 'sm' ? 0.5 : 1;
    const wrap = document.createElement('div');
    wrap.className = 'pcup' + (opts.size === 'sm' ? ' pcup-sm' : '');
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * k); canvas.height = Math.round(H * k);
    canvas.setAttribute('role', 'img');
    const ghost = document.createElement('canvas');   // 换配方时，旧画面淡出
    ghost.width = canvas.width; ghost.height = canvas.height; ghost.className = 'pcup-ghost'; ghost.setAttribute('aria-hidden', 'true');
    wrap.append(canvas, ghost);
    container.appendChild(wrap);
    const ctx = canvas.getContext('2d');
    let pending = null, first = true, prevTops = 0;

    async function draw(r) {
      const ok = await ready;
      if (!ok || pending !== r) return;
      if (!first && opts.size !== 'sm') {
        ghost.getContext('2d').drawImage(canvas, 0, 0);
        ghost.style.transition = 'none'; ghost.style.opacity = 1;
        void ghost.offsetWidth;
        ghost.style.transition = 'opacity .45s ease'; ghost.style.opacity = 0;
      }
      paint(ctx, k, r, opts.menu || PhotoCup.menu);
      wrap.classList.toggle('is-large', r.size === 'L');
      wrap.classList.toggle('is-hot', r.ice === 'hot');
      if (!first && r.tops.length > prevTops && opts.onLand) opts.onLand();
      prevTops = r.tops.length;
      first = false;
    }
    return {
      update(r) { pending = { ...r, tops: [...(r.tops || [])] }; draw(pending); },
      svg: canvas,    // 名字沿用以前的接口，方便替换
    };
  }

  return { create, ready, menu: null, setMenu(m) { PhotoCup.menu = m; } };
})();

// 全站做杯子都走这里：以后想换回画出来的杯子，把 PhotoCup 改成 Cup 就行
const makeCup = (el, opts) => PhotoCup.create(el, opts);
