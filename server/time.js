/* =========================================================
   time.js：营业时间和取餐时间
   服务器可能在任何时区（Render 的服务器用 UTC），
   所以"现在几点"一定要按店铺所在的时区来算。
   ========================================================= */

/* 某个时刻在指定时区里是几年几月几日几点几分 */
function partsIn(date, tz) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(date).map(x => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, day: `${p.year}-${p.month}-${p.day}` };
}

/* 店铺时区的"某天某时某分"对应的真实时刻 */
function zonedToDate(y, m, d, h, min, tz) {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const p = partsIn(new Date(guess), tz);
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - guess;
  return new Date(guess - offset);
}

const toMinutes = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/* 算出今天还能选的取餐时间
   返回 { open: 现在是否营业, slots: [ISO 时间...] } */
function pickupSlots(hours, tz, now = new Date()) {
  const p = partsIn(now, tz);
  const nowMin = p.h * 60 + p.min;
  const slot = hours.slotMinutes || 15;
  const prep = hours.prepMinutes || 10;

  let open, close;
  if (hours.demoAlwaysOpen) {
    open = 0; close = 24 * 60;
  } else {
    open = toMinutes(hours.open); close = toMinutes(hours.close);
  }
  const isOpen = nowMin >= open && nowMin < close - prep;

  // 最早的取餐时间：现在 + 准备时间，再向上取整到下一个时间格
  let first = Math.max(open, nowMin + prep);
  first = Math.ceil(first / slot) * slot;
  const slots = [];
  for (let t = first; t <= close - slot && slots.length < 40; t += slot) {
    slots.push(zonedToDate(p.y, p.m, p.d, Math.floor(t / 60), t % 60, tz).toISOString());
  }
  // 演示模式过了午夜也能下单：时间格不够就接着排到第二天
  if (hours.demoAlwaysOpen && slots.length < 8) {
    const base = slots.length ? new Date(slots[slots.length - 1]).getTime() : now.getTime() + prep * 60000;
    while (slots.length < 8) slots.push(new Date(base + (slots.length + 1) * slot * 60000).toISOString());
  }
  return { open: isOpen || !!hours.demoAlwaysOpen, slots, today: p.day };
}

module.exports = { partsIn, pickupSlots };
