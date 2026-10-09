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

  /* 整张订单：小计、税、合计 */
  function totals(lines, menu, taxRate) {
    const subtotal = lines.reduce((s, l) => s + recipeCents(l.recipe, menu, l.drinkId) * l.qty, 0);
    const tax = Math.round(subtotal * (taxRate || 0));
    return { subtotal, tax, total: subtotal + tax };
  }

  const format = (c, currency = 'CAD') => '$' + (c / 100).toFixed(2) + (currency === 'CAD' ? '' : ' ' + currency);

  return { checkRecipe, sameRecipe, recipeCents, totals, format, cents };
});
