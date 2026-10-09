/* =========================================================
   sound.js：背景音乐和音效
   全部用 Web Audio API 现场合成，没有用任何音频文件，所以没有版权问题。

   基本概念（和电路课里的信号是一回事）：
   - OscillatorNode 振荡器：产生正弦波、三角波等，频率决定音高
   - GainNode 增益：控制音量，随时间变化就是"包络"（envelope）
   - BiquadFilterNode 滤波器：低通滤波让声音更闷、更温暖
   - 所有节点像电路一样连起来，最后接到 destination（扬声器）

   浏览器规定：用户点击页面之前不能发出声音，所以 AudioContext
   要等用户第一次点击后才能真正启动。
   ========================================================= */

const Sound = (() => {
  let ctx = null;
  let master, musicBus, sfxBus, noiseBuf;
  let musicOn = false;
  let sfxOn = true;
  let timer = null;
  let nextTime = 0;
  let step = 0;

  const BPM = 76;
  const STEP = 60 / BPM / 4;     // 一个十六分音符的长度（秒）

  // 和弦进行：Fmaj7 → Em7 → Dm7 → Cmaj7（MIDI 音符编号）
  const CHORDS = [
    [65, 69, 72, 76],
    [64, 67, 71, 74],
    [62, 65, 69, 72],
    [60, 64, 67, 71],
  ];
  // 旋律只从五声音阶里挑音，怎么组合都好听
  const SCALE = [72, 74, 76, 79, 81, 84];
  const freq = m => 440 * Math.pow(2, (m - 69) / 12);

  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : v === '1'; } catch (e) { return fallback; }
  }
  function save(key, v) {
    try { localStorage.setItem(key, v ? '1' : '0'); } catch (e) { /* 存不了就算了 */ }
  }

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    // 音乐总线：先过一个低通滤波器，让声音更柔和，有 lo-fi 的感觉
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    musicBus.connect(lp);
    lp.connect(master);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.55;
    sfxBus.connect(master);

    // 一段白噪声，用来做鼓和"沙沙"声
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return ctx;
  }

  /* ---------- 乐器 ---------- */
  // 电钢琴：正弦波 + 稍微跑调的三角波，快速起音、慢慢衰减
  function keys(m, t, len, vel) {
    [['sine', 0], ['triangle', 4]].forEach(([type, detune], i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq(m);
      o.detune.value = detune;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel * (i ? 0.35 : 1), t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0008, t + len);
      o.connect(g).connect(musicBus);
      o.start(t);
      o.stop(t + len + 0.05);
    });
  }

  function bass(m, t, len) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq(m - 24);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(g).connect(musicBus);
    o.start(t);
    o.stop(t + len + 0.05);
  }

  // 底鼓：频率从 120Hz 快速掉到 45Hz，就是"咚"的感觉
  function kick(t) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.25);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(musicBus);
    o.start(t);
    o.stop(t + 0.4);
  }

  // 噪声鼓：军鼓和镲片都是"一段噪声 + 滤波器 + 很短的包络"
  function noiseHit(t, type, f, len, vol, bus) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    s.connect(flt).connect(g).connect(bus || musicBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + len + 0.02);
  }

  /* ---------- 编曲：每个十六分音符调用一次 ---------- */
  function playStep(s, t) {
    const bar = Math.floor(s / 16) % CHORDS.length;
    const pos = s % 16;
    const chord = CHORDS[bar];
    const swing = pos % 2 === 1 ? STEP * 0.18 : 0;    // 一点点摇摆感
    t += swing;

    if (pos === 0) { chord.forEach(m => keys(m, t, 2.6, 0.07)); bass(chord[0], t, 1.2); }
    if (pos === 10) chord.slice(1).forEach(m => keys(m, t, 1.2, 0.04));
    if (pos === 8) bass(chord[0] + 7, t, 0.9);
    if (pos === 0 || pos === 8 || pos === 11) kick(t);
    if (pos === 4 || pos === 12) noiseHit(t, 'bandpass', 1800, 0.18, 0.12);
    if (pos % 2 === 0) noiseHit(t, 'highpass', 7000, 0.04, pos % 4 === 2 ? 0.05 : 0.025);
    if (pos % 2 === 0 && Math.random() < 0.28) {
      keys(SCALE[Math.floor(Math.random() * SCALE.length)], t, 0.9, 0.05);
    }
  }

  // 调度器：每 25 毫秒看一下，把接下来 0.15 秒内要响的音提前安排好。
  // 直接用 setTimeout 播放会不准时，提前交给音频时钟安排才稳定。
  function scheduler() {
    while (nextTime < ctx.currentTime + 0.15) {
      playStep(step, nextTime);
      nextTime += STEP;
      step++;
    }
  }

  function startMusic() {
    if (!ensure()) return false;
    ctx.resume();
    if (timer) return true;
    nextTime = ctx.currentTime + 0.1;
    step = 0;
    timer = setInterval(scheduler, 25);
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime);
    musicBus.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2);   // 2 秒淡入
    return true;
  }

  function stopMusic() {
    if (!ctx || !timer) return;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime);
    musicBus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);   // 淡出
    const tm = timer;
    timer = null;
    setTimeout(() => clearInterval(tm), 700);   // 等淡出结束再停掉调度器
  }

  /* ---------- 音效 ---------- */
  function sfx(fn) {
    if (!sfxOn || !ensure()) return;
    if (ctx.state !== 'running') ctx.resume();
    fn(ctx.currentTime + 0.01);
  }

  const effects = {
    // 珍珠落水"咚"：频率快速下降的正弦波
    plop: () => sfx(t => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(700 + Math.random() * 200, t);
      o.frequency.exponentialRampToValueAtTime(140, t + 0.12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.connect(g).connect(sfxBus);
      o.start(t);
      o.stop(t + 0.2);
    }),
    // 冰块"叮"：两个高频三角波，衰减很快
    clink: () => sfx(t => {
      [2100, 3150].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        g.gain.setValueAtTime(i ? 0.08 : 0.15, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o.connect(g).connect(sfxBus);
        o.start(t);
        o.stop(t + 0.3);
      });
    }),
    // 转盘"嗒"：一小段高通噪声
    tick: () => sfx(t => noiseHit(t, 'highpass', 3500, 0.03, 0.35, sfxBus)),
    // 倒茶"哗"：滤波器频率扫动的噪声
    pour: () => sfx(t => {
      const s = ctx.createBufferSource();
      s.buffer = noiseBuf;
      const flt = ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.Q.value = 2;
      flt.frequency.setValueAtTime(400, t);
      flt.frequency.exponentialRampToValueAtTime(1600, t + 0.35);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      s.connect(flt).connect(g).connect(sfxBus);
      s.start(t);
      s.stop(t + 0.45);
    }),
    // 加入购物车 / 下单成功：上行的三个音
    chime: () => sfx(t => {
      [76, 79, 84].forEach((m, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = freq(m);
        const st = t + i * 0.09;
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(0.22, st + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, st + 0.5);
        o.connect(g).connect(sfxBus);
        o.start(st);
        o.stop(st + 0.55);
      });
    }),
  };

  /* ---------- 开关和记忆 ---------- */
  function setMusic(on) {
    musicOn = on;
    save('hitea-music', on);
    if (on) startMusic(); else stopMusic();
    return musicOn;
  }
  function setSfx(on) {
    sfxOn = on;
    save('hitea-sfx', on);
    return sfxOn;
  }

  // 上次开着音乐的话：浏览器不让自动播放，就等用户第一次点击页面时再接着放
  function init() {
    sfxOn = load('hitea-sfx', true);
    const wantMusic = load('hitea-music', false);
    if (wantMusic) {
      musicOn = true;
      const resume = () => { if (musicOn) startMusic(); };
      window.addEventListener('pointerdown', resume, { once: true });
      window.addEventListener('keydown', resume, { once: true });
    }
    // 切到别的标签页时暂停，回来再继续
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else if (musicOn || sfxOn) ctx.resume();
    });
  }

  return {
    init,
    setMusic, setSfx,
    get musicOn() { return musicOn; },
    get sfxOn() { return sfxOn; },
    ...effects,
  };
})();
