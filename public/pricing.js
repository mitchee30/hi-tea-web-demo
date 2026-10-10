/* =========================================================
   pricing.js：价格计算和配方检查
   浏览器和服务器共用同一份代码：
   - 浏览器里用它显示价格
   - 服务器用它重新算一遍价格。永远不要相信浏览器发来的价格，
     不然别人改一下请求就能 1 分钱买一杯奶茶。

   金额全部用"分"（整数）计算，避免 0.1 + 0.2 = 0.30000000000000004 这类小数误差。
   ========================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();   // Node.js
  else root.Pricing = factory();                                                  // 浏览器
})(typeof self !== 'undefined' ? self : this, function () {
  const cents = dollars => Math.round(Number(dollars || 0) * 100);
  const find = (list, id) => (list || []).find(x => x.id === id);

  /* 检查一杯配方是否合法：每一项都必须存在，而且没有售罄 */
  function checkRecipe(r, menu, maxTops = 3) {
    if (!r || typeof r !== 'object') return { ok: false, error: 'bad_recipe' };
    const tea = find(menu.teas, r.tea);
    const milk = find(menu.milks, r.milk);
    const sweet = find(menu.sweets, Number(r.sweet));
    const ice = find(menu.ices, r.ice);
    const size = find(menu.sizes, r.size);
    if (!tea || !milk || !sweet || !ice || !size) return { ok: false, error: 'unknown_option' };
    if (tea.available === false || milk.available === false) return { ok: false, error: 'sold_out' };
    const tops = Array.isArray(r.tops) ? [...new Set(r.tops)] : [];
    if (tops.length > maxTops) return { ok: false, error: 'too_many_toppings' };
    for (const t of tops) {
      const tp = find(menu.toppings, t);
      if (!tp) return { ok: false, error: 'unknown_option' };
      if (tp.available === false) return { ok: false, error: 'sold_out' };
    }
    return { ok: true, recipe: { tea: tea.id, milk: milk.id, sweet: sweet.id, ice: ice.id, size: size.id, tops } };
  }

  const sameRecipe = (a, b) =>
    a.tea === b.tea && a.milk === b.milk && Number(a.sweet) === Number(b.sweet) && a.ice === b.ice &&
    a.size === b.size && [...a.tops].sort().join() === [...b.tops].sort().join();

  /* 一杯的价格（分）。如果正好是某款招牌、而且店家给它单独定了价，就用那个价格 */
  function recipeCents(r, menu, drinkId) {
    if (drinkId) {
      const d = find(menu.drinks, drinkId);
      if (d && d.price != null && d.price !== '' && sameRecipe(d.preset, r)) return cents(d.price);
    }
    let c = cents(find(menu.teas, r.tea).price) + cents(find(menu.milks, r.milk).price) + cents(find(menu.sizes, r.size).price);
    r.tops.forEach(t => { c += cents(find(menu.toppings, t).price); });
    return c;
  }

  /* 整张订单：小计、优惠、税、合计（税按优惠后的金额算） */
  function totals(lines, menu, taxRate, discount = 0) {
    const subtotal = lines.reduce((s, l) => s + recipeCents(l.recipe, menu, l.drinkId) * l.qty, 0);
    const d = Math.max(0, Math.min(discount, subtotal));
    const tax = Math.round((subtotal - d) * (taxRate || 0));
    return { subtotal, discount: d, tax, total: subtotal - d + tax };
  }

  /* 优惠：集点卡免费一杯 + 优惠码
     - 集点兑换：订单里最便宜的那一杯免费
     - 优惠码：percent 打折（比如 10 = 9 折），amount 直接减（比如 1 = 减 $1）
     返回 { reward, coupon, error } ，金额都是"分"；error 是优惠码不能用的原因 */
  function discounts({ lines, menu, useReward = false, coupon = null, now = new Date() }) {
    const subtotal = lines.reduce((s, l) => s + recipeCents(l.recipe, menu, l.drinkId) * l.qty, 0);
    const units = lines.map(l => recipeCents(l.recipe, menu, l.drinkId));
    const reward = useReward && units.length ? Math.min(...units) : 0;
    let off = 0, error = null;
    if (coupon) {
      if (!coupon.active) error = 'coupon_inactive';
      else if (coupon.expires && new Date(coupon.expires + 'T23:59:59') < now) error = 'coupon_expired';
      else if (coupon.maxUses != null && (coupon.uses || 0) >= coupon.maxUses) error = 'coupon_used_up';
      else if (subtotal < cents(coupon.minSubtotal || 0)) error = 'coupon_min';
      else {
        const rest = subtotal - reward;
        off = coupon.type === 'percent'
          ? Math.round(rest * Math.max(0, Math.min(100, coupon.value)) / 100)
          : Math.min(cents(coupon.value), rest);
      }
    }
    return { reward, coupon: off, error, subtotal };
  }

  /* 咖啡因和过敏原：从茶底、奶、小料汇总出来 */
  const CAFFEINE_RANK = { none: 0, low: 1, mid: 2, high: 3 };
  function traits(r, menu) {
    const tea = find(menu.teas, r.tea) || {};
    const milk = find(menu.milks, r.milk) || {};
    const allergens = new Set(milk.allergens || []);
    (r.tops || []).forEach(t => ((find(menu.toppings, t) || {}).allergens || []).forEach(a => allergens.add(a)));
    // 有没有不含乳制品的奶可以换（给"可以做成无乳糖"提示用）
    const dairyFreeMilk = (menu.milks || []).some(m => m.available !== false && m.id !== 'none' && !(m.allergens || []).includes('dairy'));
    return { caffeine: tea.caffeine || 'none', allergens: [...allergens].sort(), dairyFreeMilk };
  }

  const format = (c, currency = 'CAD') => '$' + (c / 100).toFixed(2) + (currency === 'CAD' ? '' : ' ' + currency);

  return { checkRecipe, sameRecipe, recipeCents, totals, discounts, traits, CAFFEINE_RANK, format, cents };
});
