/* =========================================================
   film.js：苹果官网那种"滚动播放"
   做法：一段产品视频 → 用 tools/make-frames.sh 拆成很多张图（帧）
        → 网页上用 <canvas> 画出来，滚动到哪儿就画哪一帧。
   看起来就像在用手指"控制"视频：往下滑，杯子就一层层分开；往回滑，又合上。

   - 帧的说明文件（frames.json）不存在时什么都不做，首页继续显示 story.js 的 SVG 版本
   - 手机竖屏用单独裁好的竖版帧，流量更小
   - 先载第一帧，快滚到这里时再按顺序载入其余的；没载完的帧先用最近的那张顶上
   - 叠在画面上的文字（beats）写在 shop.config.json 的 story.beats 里
   ========================================================= */

const Film = (() => {
  let meta = null, base = '', set = null, frames = [], ok = [], started = false;
  let sec, stage, canvas, ctx, beatsBox, loadBar, ticking = false, lastDrawn = -1, lastSize = '';
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

  async function init() {
    const conf = CFG.story;
    if (!conf || !conf.frames) return false;
    try {
      const res = await fetch(conf.frames, { cache: 'no-cache' });
      if (!res.ok) return false;
      meta = await res.json();
    } catch (e) { return false; }
    if (!meta || !meta.count || !meta.desktop) return false;
    base = conf.frames.replace(/[^/]*$/, '');

    sec = document.getElementById('film');
    stage = sec.querySelector('.film-stage');
    canvas = document.getElementById('filmCanvas');
    ctx = canvas.getContext('2d');
    beatsBox = document.getElementById('filmBeats');
    loadBar = document.getElementById('filmLoad');
    if (meta.bg) sec.style.setProperty('--film-bg', meta.bg);

    // 有视频帧了：用它，藏起 SVG 版
    sec.hidden = false;
    document.getElementById('story').hidden = true;
    pickSet();
    renderBeats();

    const still = matchMedia('(prefers-reduced-motion: reduce)');
    const applyStill = () => sec.classList.toggle('is-static', still.matches);
    applyStill();
    still.addEventListener?.('change', () => { applyStill(); onScroll(); });

    // 先只载第一帧（和静态时显示的那帧）；快滚到附近再载全部
    load(0).then(draw);
    if (meta.staticAt != null) load(Math.round(meta.staticAt * (meta.count - 1)));
    new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) loadAll(); }, { rootMargin: '150% 0px' }).observe(sec);

    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', () => { pickSet(); onScroll(); });
    return true;
  }

  /* 电脑用横版，手机竖屏用竖版 */
  function pickSet() {
    const want = meta.mobile && matchMedia('(max-width: 760px) and (orientation: portrait)').matches ? 'mobile' : 'desktop';
    if (want === set) return;
    set = want;
    frames = new Array(meta.count);
    ok = new Array(meta.count).fill(false);
    started = false;
    lastDrawn = -1;
    load(0).then(draw);
  }

  const src = i => base + meta[set].path.replace('%04d', String(i + 1).padStart(4, '0'));

  function load(i) {
    if (frames[i]) return frames[i].ready;
    const img = new Image();
    img.decoding = 'async';
    const ready = new Promise(res => {
      img.onload = () => { ok[i] = true; res(); };
      img.onerror = () => res();
    });
    img.src = src(i);
    frames[i] = { img, ready };
    return ready;
  }

  /* 按顺序载入，同时最多 6 张；每载好一张更新进度条 */
  async function loadAll() {
    if (started) return;
    started = true;
    const mySet = set;
    let next = 0, done = 0;
    loadBar.hidden = false;
    const worker = async () => {
      while (next < meta.count && set === mySet) {
        const i = next++;
        await load(i);
        done++;
        loadBar.style.setProperty('--p', (done / meta.count).toFixed(3));
        if (Math.abs(i - lastDrawn) < 3) onScroll();
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    if (set === mySet) loadBar.hidden = true;
    onScroll();
  }

  function nearest(i) {
    if (ok[i]) return i;
    for (let d = 1; d < meta.count; d++) {
      if (ok[i - d]) return i - d;
      if (ok[i + d]) return i + d;
    }
    return -1;
  }

  /* 把一帧铺满画面（像 CSS 的 object-fit: cover），焦点可以偏一点 */
  function paint(img) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = stage.clientWidth, h = stage.clientHeight;
    const size = `${w}x${h}x${dpr}`;
    if (size !== lastSize) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      lastSize = size;
    }
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const k = Math.max(canvas.width / iw, canvas.height / ih);
    const dw = iw * k, dh = ih * k;
    const fx = meta[set].focusX ?? 0.5;      // 裁剪时尽量保住产品
    const dx = (canvas.width - dw) * fx, dy = (canvas.height - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function progress() {
    const r = sec.getBoundingClientRect();
    const total = r.height - innerHeight;
    return total > 0 ? clamp(-r.top / total) : 0;
  }

  function draw() {
    ticking = false;
    if (!meta || sec.hidden || document.getElementById('view-home').hidden) return;
    const still = sec.classList.contains('is-static');
    const p = still ? (meta.staticAt ?? 0.6) : progress();
    const want = Math.round(p * (meta.count - 1));
    const i = nearest(want);
    if (i >= 0 && (i !== lastDrawn || lastSize !== `${stage.clientWidth}x${stage.clientHeight}x${Math.min(devicePixelRatio || 1, 2)}`)) {
      paint(frames[i].img);
      lastDrawn = i;
    }
    // 文字：在自己的区间里淡入淡出、轻轻上移
    [...beatsBox.children].forEach(b => {
      const from = Number(b.dataset.from), to = Number(b.dataset.to);
      const fade = 0.05;
      const a = still ? (b.dataset.first ? 1 : 0)
        : (from <= 0 ? 1 : clamp((p - from) / fade)) * (to >= 1 ? 1 : clamp((to - p) / fade));
      b.style.opacity = a;
      b.style.transform = `translateY(${(1 - a) * 24}px)`;
      b.style.pointerEvents = a > 0.5 ? 'auto' : 'none';
      // 列表一条一条出来
      b.querySelectorAll('li').forEach((li, k, all) => {
        const at = from + (to - from) * (0.08 + 0.5 * k / all.length);
        const v = still ? 1 : clamp((p - at) / 0.03);
        li.style.opacity = v;
        li.style.transform = `translateX(${(1 - v) * -14}px)`;
      });
    });
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(draw); }
  }

  function renderBeats() {
    if (!beatsBox) return;
    const beats = (CFG.story && CFG.story.beats) || [];
    beatsBox.innerHTML = beats.map((b, k) => `
      <div class="film-beat ${b.side || 'left'}" data-from="${b.from}" data-to="${b.to}" ${k === 0 ? 'data-first="1"' : ''}>
        ${b.kicker ? `<p class="st-kicker">${esc(L(b.kicker))}</p>` : ''}
        ${b.title ? `<h2 class="st-big">${esc(L(b.title))}</h2>` : ''}
        ${b.sub ? `<p class="st-sub">${esc(L(b.sub))}</p>` : ''}
        ${b.list ? `<ul class="film-list">${b.list.map(x => `<li>${esc(L(x))}</li>`).join('')}</ul>` : ''}
        ${b.cta ? `<a class="btn st-go" href="${esc(b.cta.href)}">${esc(L(b.cta.label))}</a>` : ''}
      </div>`).join('');
    onScroll();
  }

  return { init, rebuild: renderBeats, update: onScroll, active: () => !!meta };
})();
