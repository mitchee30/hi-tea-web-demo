/* =========================================================
   menu.js：检查店员后台提交的菜单
   后台改菜单时，把整份菜单发过来。这里逐项检查，
   不合法的数据（价格是负数、名字太长、引用了不存在的茶底……）直接拒绝。
   ========================================================= */

const isHex = v => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
const isId = v => typeof v === 'string' && /^[a-z0-9-]{1,32}$/.test(v);
const text = (v, max = 60) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const name2 = (v, max) => v && text(v.zh, max) && text(v.en, max);
const price = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;

function fail(msg) { const e = new Error(msg); e.status = 400; throw e; }

function uniqueIds(list, label) {
  const ids = list.map(x => x.id);
  if (new Set(ids.map(String)).size !== ids.length) fail(`${label}: duplicate id`);
}

function validateMenu(m, base) {
  if (!m || typeof m !== 'object') fail('menu missing');
  const out = {};

  // 甜度、冰量的选项是固定的（和杯子动画绑在一起），不让后台改结构
  out.sweets = base.sweets;
  out.ices = base.ices;

  if (!Array.isArray(m.teas) || m.teas.length < 1 || m.teas.length > 30) fail('teas');
  out.teas = m.teas.map(t => {
    if (!isId(t.id) || !name2(t.name, 30) || !price(t.price) || !isHex(t.top) || !isHex(t.bottom)) fail('tea ' + t.id);
    return { id: t.id, name: { zh: t.name.zh.trim(), en: t.name.en.trim() }, top: t.top, bottom: t.bottom, price: t.price, available: t.available !== false };
  });
  uniqueIds(out.teas, 'teas');

  if (!Array.isArray(m.milks) || m.milks.length < 1 || m.milks.length > 10) fail('milks');
  out.milks = m.milks.map(x => {
    if (!isId(x.id) || !name2(x.name, 30) || !price(x.price)) fail('milk ' + x.id);
    const mixv = typeof x.mix === 'number' ? Math.max(0, Math.min(0.8, x.mix)) : 0.4;
    return { id: x.id, name: { zh: x.name.zh.trim(), en: x.name.en.trim() }, mix: mixv, price: x.price, available: x.available !== false };
  });
  uniqueIds(out.milks, 'milks');

  if (!Array.isArray(m.sizes) || m.sizes.length < 1 || m.sizes.length > 5) fail('sizes');
  out.sizes = m.sizes.map(x => {
    if (!isId(x.id.toLowerCase ? x.id.toLowerCase() : '') || !name2(x.name, 20) || !price(x.price)) fail('size ' + x.id);
    return { id: x.id, name: { zh: x.name.zh.trim(), en: x.name.en.trim() }, price: x.price };
  });
  uniqueIds(out.sizes, 'sizes');

  if (!Array.isArray(m.toppings) || m.toppings.length > 30) fail('toppings');
  out.toppings = m.toppings.map(t => {
    if (!isId(t.id) || !name2(t.name, 30) || !price(t.price)) fail('topping ' + t.id);
    const zone = ['bottom', 'float', 'top'].includes(t.zone) ? t.zone : 'bottom';
    return {
      id: t.id, name: { zh: t.name.zh.trim(), en: t.name.en.trim() },
      light: isHex(t.light) ? t.light : '#DDDDDD', dark: isHex(t.dark) ? t.dark : '#555555',
      r: Math.max(0, Math.min(24, Number(t.r) || 8)), count: Math.max(0, Math.min(24, Number(t.count) || 12)),
      zone, price: t.price, available: t.available !== false,
    };
  });
  uniqueIds(out.toppings, 'toppings');

  const has = (list, id) => list.some(x => String(x.id) === String(id));
  if (!Array.isArray(m.drinks) || m.drinks.length > 40) fail('drinks');
  out.drinks = m.drinks.map(d => {
    if (!isId(d.id) || !name2(d.name, 30) || !name2(d.short || d.name, 12)) fail('drink ' + d.id);
    const p = d.preset || {};
    if (!has(out.teas, p.tea) || !has(out.milks, p.milk) || !has(out.sweets, p.sweet) || !has(out.ices, p.ice) || !has(out.sizes, p.size)) fail('drink recipe ' + d.id);
    const tops = Array.isArray(p.tops) ? [...new Set(p.tops)] : [];
    if (tops.length > 3 || !tops.every(t => has(out.toppings, t))) fail('drink toppings ' + d.id);
    const descOk = d.desc && typeof d.desc.zh === 'string' && typeof d.desc.en === 'string' && d.desc.zh.length <= 80 && d.desc.en.length <= 120;
    const override = d.price === null || d.price === undefined || d.price === '' ? null : d.price;
    if (override !== null && !price(override)) fail('drink price ' + d.id);
    return {
      id: d.id, active: d.active !== false,
      name: { zh: d.name.zh.trim(), en: d.name.en.trim() },
      short: d.short ? { zh: d.short.zh.trim(), en: d.short.en.trim() } : { zh: d.name.zh.trim().slice(0, 6), en: d.name.en.trim().slice(0, 12) },
      desc: descOk ? { zh: d.desc.zh.trim(), en: d.desc.en.trim() } : { zh: '', en: '' },
      preset: { tea: p.tea, milk: p.milk, sweet: Number(p.sweet), ice: p.ice, size: p.size, tops },
      tags: Array.isArray(d.tags) ? d.tags.filter(x => ['sweet', 'warmok', 'cozy', 'caffeine', 'classic', 'fruity', 'fresh'].includes(x)) : [],
      price: override,
    };
  });
  uniqueIds(out.drinks, 'drinks');
  return out;
}

module.exports = { validateMenu };
