/* =========================================================
   i18n.js：中英双语
   - 页面上写死的文字：在 HTML 标签上加 data-i18n="键名"，切换语言时自动替换
   - JavaScript 里的文字：用 t('键名') 取
   - 菜单名字这类 { zh: '...', en: '...' } 的数据：用 L(对象) 取当前语言
   ========================================================= */
const I18N = (() => {
  const dict = {
    zh: {
      'ribbon': '这是一家虚构的奶茶店，用来演示网站功能，价格仅为示例',
      'nav.home': '首页', 'nav.diy': '自己调', 'nav.menu': '招牌菜单', 'nav.wheel': '今天喝什么',
      'tool.music': '音乐', 'tool.sfx': '音效', 'tool.cart': '购物车', 'tool.lang': 'EN', 'tool.themeLabel': '切换深色/浅色',
      'tool.langLabel': 'Switch to English', 'tool.order': '订单',
      'table.badge': '{n} 号桌',
      'home.sub': '自己动手调一杯，从招牌菜单里挑，或者让天气和心情帮你决定。',
      'home.diy': '自己调一杯', 'home.diyDesc': '茶底、奶、甜度、冰量、小料，全部你说了算。看着珍珠一颗颗掉进杯子里。',
      'home.go': '开始调 →',
      'home.menu': '招牌菜单', 'home.menuDesc': '店里的人气配方，选好就能下单。',
      'home.wheel': '今天喝什么？', 'home.wheelDesc': '看看外面的天气，说说现在的心情，转一下帮你选。',
      'back': '← 首页',
      'diy.title': '自己调一杯', 'diy.add': '加入购物车', 'diy.share': '复制这杯的链接', 'diy.reset': '重新调',
      'step.tea': '选茶底', 'step.milk': '加奶', 'step.sweet': '甜度', 'step.ice': '冰量', 'step.size': '杯型',
      'step.tops': '小料', 'step.topsMax': '最多 {n} 种',
      'soldout': '售罄', 'soldoutToday': '今日售罄',
      'menu.title': '招牌菜单', 'menu.sub': '每一杯都可以点"改一改"，换成你喜欢的甜度和冰量。',
      'menu.custom': '改一改', 'menu.add': '加入购物车',
      'wheel.title': '今天喝什么？', 'wheel.mood': '现在的心情', 'wheel.spin': '帮我选一杯', 'wheel.again': '再选一次',
      'wheel.add': '加入购物车', 'wheel.custom': '改一改',
      'weather.loading': '正在看{city}今天的天气…',
      'weather.now': '{city}现在 {t}°C，{kind}。不对的话可以改：', 'weather.fail': '暂时拿不到天气，你可以手动选：',
      'weather.cold': '有点冷', 'weather.mild': '不冷不热', 'weather.hot': '挺热的', 'weather.rain': '在下雨',
      'mood.wake': '要提神', 'mood.sweet': '想吃甜的', 'mood.fresh': '想清爽一点', 'mood.any': '随便，你定',
      'why.cold': '外面有点冷，来一杯热的暖暖手。', 'why.rain': '下雨天，适合捧着一杯热饮慢慢喝。',
      'why.hot': '天这么热，喝点冰的清爽一下。', 'why.mild': '今天天气舒服，正适合来一杯。',
      'why.wake': '茶底带咖啡因，下午不犯困。', 'why.sweet': '甜度刚好，治愈一下。', 'why.fresh': '口感清爽，不腻。',
      'why.any': '这杯是店里的人气款。', 'why.madeHot': '已经帮你改成热的了。',
      'custom': '我的特调',
      'cart.title': '购物车', 'cart.empty': '购物车还是空的。', 'cart.toMenu': '去看看招牌菜单', 'cart.subtotal': '小计',
      'cart.checkout': '去结账', 'cart.less': '少一杯', 'cart.more': '多一杯', 'cart.count': '购物车，{n} 杯',
      'cart.added': '已加入购物车：{name}', 'cart.removedSoldOut': '有饮品的原料售罄了，已从购物车移除',
      'toast.maxTops': '小料最多选 {n} 种', 'toast.copied': '链接已复制，发给朋友就能看到这一杯',
      'toast.copyFail': '复制失败，可以直接复制浏览器地址栏的网址', 'toast.menuUpdated': '菜单更新了',
      'toast.soldOut': '{name}刚刚售罄了',
      'co.title': '确认订单', 'co.items': '你点的', 'co.how': '怎么取', 'co.pickup': '到店自取', 'co.table': '堂食 · {n} 号桌',
      'co.time': '取餐时间', 'co.asap': '尽快（大约 {n} 分钟）', 'co.name': '你的名字', 'co.namePh': '取餐时叫这个名字',
      'co.phone': '手机号（选填）', 'co.note': '备注（选填）', 'co.notePh': '比如：少冰一点',
      'co.pay': '付款方式', 'co.payStore': '到店付款', 'co.payOnline': '在线支付（信用卡）',
      'co.payOnlineHint': 'Stripe 测试模式：卡号 4242 4242 4242 4242，不会真的扣钱',
      'co.subtotal': '小计', 'co.tax': '{name} 税', 'co.total': '合计', 'co.submit': '提交订单 · {total}',
      'co.submitting': '正在提交…', 'co.empty': '购物车是空的，先去挑一杯吧。', 'co.closed': '现在不营业，营业时间 {open}–{close}。',
      'co.demo': '演示模式：没有连接服务器，订单只保存在这台设备上，会自动模拟制作过程。',
      'err.sold_out': '有饮品的原料刚刚售罄了，请修改购物车', 'err.closed': '现在不营业',
      'err.bad_pickup_time': '这个取餐时间已经过了，请重新选', 'err.name_required': '请填写名字，方便叫号',
      'err.too_many_requests': '下单太频繁了，请稍后再试', 'err.network': '网络好像断了，请稍后再试',
      'err.generic': '下单失败，请再试一次', 'err.payment': '暂时无法在线支付，已改为到店付款',
      'ord.title': '我的订单', 'ord.number': '取餐号', 'ord.pickupAt': '取餐时间', 'ord.asap': '尽快',
      'ord.table': '{n} 号桌', 'ord.name': '名字',
      'ord.s.awaiting_payment': '等待付款', 'ord.s.new': '已下单', 'ord.s.making': '制作中', 'ord.s.ready': '可以取餐',
      'ord.s.done': '已取餐', 'ord.s.cancelled': '已取消',
      'ord.readyBanner': '做好啦！请到柜台取餐', 'ord.readyBannerTable': '做好啦！马上送到你桌上',
      'ord.cancelled': '这一单已取消，有疑问请联系店员。',
      'ord.unpaid': '还没有付款', 'ord.payCanceled': '付款已取消。', 'ord.payNow': '去付款', 'ord.payInStore': '改为到店付款',
      'ord.paid': '已在线付款', 'ord.payAtStore': '到店付款', 'ord.notify': '做好后提醒我',
      'ord.notifyOn': '做好后会提醒你', 'ord.again': '再点一杯', 'ord.notFound': '找不到这个订单。',
      'ord.live': '页面会自动更新，不用刷新', 'ord.notifTitle': '你的奶茶做好啦', 'ord.notifBody': '取餐号 {n}',
      'foot': '这是一家虚构的店，仅用于演示 · 网站设计与开发：Wenbo Zhi',
    },
    en: {
      'ribbon': 'This is a fictional shop built to demo the website. Prices are placeholders.',
      'nav.home': 'Home', 'nav.diy': 'Build', 'nav.menu': 'Menu', 'nav.wheel': 'Pick for me',
      'tool.music': 'Music', 'tool.sfx': 'Sound', 'tool.cart': 'Cart', 'tool.lang': '中文', 'tool.themeLabel': 'Switch dark / light',
      'tool.langLabel': '切换到中文', 'tool.order': 'Order',
      'table.badge': 'Table {n}',
      'home.sub': 'Build your own drink, pick from the menu, or let the weather and your mood decide.',
      'home.diy': 'Build your drink', 'home.diyDesc': 'Tea, milk, sugar, ice, toppings. All your call. Watch the pearls drop in one by one.',
      'home.go': 'Start building →',
      'home.menu': 'Signature menu', 'home.menuDesc': 'Our most popular recipes, ready to order.',
      'home.wheel': 'What should I drink?', 'home.wheelDesc': 'Tell us your mood, we check the weather, and the wheel picks for you.',
      'back': '← Home',
      'diy.title': 'Build your drink', 'diy.add': 'Add to cart', 'diy.share': 'Copy link to this drink', 'diy.reset': 'Start over',
      'step.tea': 'Tea', 'step.milk': 'Milk', 'step.sweet': 'Sugar', 'step.ice': 'Ice', 'step.size': 'Size',
      'step.tops': 'Toppings', 'step.topsMax': 'up to {n}',
      'soldout': 'Sold out', 'soldoutToday': 'Sold out today',
      'menu.title': 'Signature menu', 'menu.sub': 'Tap "Customise" on any drink to change the sugar or ice.',
      'menu.custom': 'Customise', 'menu.add': 'Add to cart',
      'wheel.title': 'What should I drink?', 'wheel.mood': 'How are you feeling?', 'wheel.spin': 'Pick one for me', 'wheel.again': 'Spin again',
      'wheel.add': 'Add to cart', 'wheel.custom': 'Customise',
      'weather.loading': 'Checking the weather in {city}…',
      'weather.now': "It's {t}°C in {city} right now, {kind}. Not right? Change it:", 'weather.fail': "Couldn't get the weather. Pick it yourself:",
      'weather.cold': 'a bit cold', 'weather.mild': 'mild', 'weather.hot': 'hot', 'weather.rain': 'raining',
      'mood.wake': 'Need a boost', 'mood.sweet': 'Craving sweet', 'mood.fresh': 'Something light', 'mood.any': 'Surprise me',
      'why.cold': "It's chilly out, so here's something warm for your hands. ", 'why.rain': 'Rainy day, perfect for a warm drink. ',
      'why.hot': "It's hot out, so something icy will help. ", 'why.mild': "Nice weather, good time for a drink. ",
      'why.wake': 'The tea has caffeine to get you through the afternoon. ', 'why.sweet': 'Just sweet enough to cheer you up. ', 'why.fresh': 'Light and refreshing. ',
      'why.any': "It's one of our most popular. ", 'why.madeHot': "We've made it hot for you.",
      'custom': 'Custom drink',
      'cart.title': 'Cart', 'cart.empty': 'Your cart is empty.', 'cart.toMenu': 'Browse the menu', 'cart.subtotal': 'Subtotal',
      'cart.checkout': 'Checkout', 'cart.less': 'One fewer', 'cart.more': 'One more', 'cart.count': 'Cart, {n} drinks',
      'cart.added': 'Added to cart: {name}', 'cart.removedSoldOut': 'Something in your cart sold out and was removed',
      'toast.maxTops': 'Up to {n} toppings', 'toast.copied': 'Link copied. Send it to a friend to share this drink.',
      'toast.copyFail': "Couldn't copy. Copy the address bar instead.", 'toast.menuUpdated': 'The menu was updated',
      'toast.soldOut': '{name} just sold out',
      'co.title': 'Checkout', 'co.items': 'Your order', 'co.how': 'How', 'co.pickup': 'Pickup', 'co.table': 'Dine in · Table {n}',
      'co.time': 'Pickup time', 'co.asap': 'As soon as possible (about {n} min)', 'co.name': 'Your name', 'co.namePh': "We'll call this name",
      'co.phone': 'Phone (optional)', 'co.note': 'Note (optional)', 'co.notePh': 'e.g. a little less ice',
      'co.pay': 'Payment', 'co.payStore': 'Pay at the counter', 'co.payOnline': 'Pay online (card)',
      'co.payOnlineHint': 'Stripe test mode: use card 4242 4242 4242 4242. No real charge.',
      'co.subtotal': 'Subtotal', 'co.tax': '{name}', 'co.total': 'Total', 'co.submit': 'Place order · {total}',
      'co.submitting': 'Placing order…', 'co.empty': 'Your cart is empty. Pick a drink first.', 'co.closed': "We're closed. Hours: {open}–{close}.",
      'co.demo': 'Demo mode: no server connected. The order stays on this device and the prep steps are simulated.',
      'err.sold_out': 'Something in your cart just sold out. Please update your cart.', 'err.closed': "We're closed right now",
      'err.bad_pickup_time': 'That pickup time has passed. Please pick another.', 'err.name_required': 'Please enter a name so we can call you',
      'err.too_many_requests': 'Too many orders. Please try again in a few minutes.', 'err.network': 'Network problem. Please try again.',
      'err.generic': "Couldn't place the order. Please try again.", 'err.payment': 'Online payment is unavailable, so this order is set to pay at the counter',
      'ord.title': 'Your order', 'ord.number': 'Order number', 'ord.pickupAt': 'Pickup', 'ord.asap': 'As soon as possible',
      'ord.table': 'Table {n}', 'ord.name': 'Name',
      'ord.s.awaiting_payment': 'Awaiting payment', 'ord.s.new': 'Received', 'ord.s.making': 'Making', 'ord.s.ready': 'Ready',
      'ord.s.done': 'Picked up', 'ord.s.cancelled': 'Cancelled',
      'ord.readyBanner': 'Ready! Come grab it at the counter', 'ord.readyBannerTable': 'Ready! Bringing it to your table',
      'ord.cancelled': 'This order was cancelled. Please ask our staff if you have questions.',
      'ord.unpaid': 'Not paid yet', 'ord.payCanceled': 'Payment was cancelled.', 'ord.payNow': 'Pay now', 'ord.payInStore': 'Pay at the counter instead',
      'ord.paid': 'Paid online', 'ord.payAtStore': 'Pay at the counter', 'ord.notify': 'Notify me when ready',
      'ord.notifyOn': "We'll notify you when it's ready", 'ord.again': 'Order another', 'ord.notFound': "We couldn't find this order.",
      'ord.live': 'This page updates by itself', 'ord.notifTitle': 'Your drink is ready', 'ord.notifBody': 'Order {n}',
      'foot': 'A fictional shop, for demo only · Designed and built by Wenbo Zhi',
    },
  };

  // 默认语言：用户之前选过就用之前的；没选过就看浏览器语言
  let lang = null;
  try { lang = localStorage.getItem('hitea-lang'); } catch (e) { /* 隐私模式可能读不了 */ }
  if (lang !== 'zh' && lang !== 'en') lang = (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';

  function t(key, vars) {
    let s = (dict[lang] && dict[lang][key]) || dict.zh[key] || key;
    if (vars) Object.entries(vars).forEach(([k, v]) => { s = s.split('{' + k + '}').join(v); });
    return s;
  }
  const L = obj => (obj && typeof obj === 'object' ? obj[lang] || obj.zh || obj.en || '' : obj || '');

  function apply(root = document) {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    root.querySelectorAll('[data-i18n-label]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nLabel)); });
  }

  function set(l) {
    lang = l === 'en' ? 'en' : 'zh';
    try { localStorage.setItem('hitea-lang', lang); } catch (e) { /* 存不了就算了 */ }
    apply();
  }

  return { t, L, apply, set, get lang() { return lang; }, extend: (l, more) => Object.assign(dict[l], more) };
})();
const t = I18N.t;
const L = I18N.L;

/* ---------- 店铺信息、等待时间、集点卡、优惠码、标签、安装 App ---------- */
I18N.extend('zh', {
  'store.title': '店铺信息', 'store.address': '地址', 'store.hours': '营业时间', 'store.phone': '电话',
  'store.directions': '在地图上打开', 'store.open': '营业中 · {close} 打烊', 'store.closed': '已打烊 · {open} 开门',
  'store.closedDemo': '已打烊（演示期间仍可下单）', 'store.daily': '每天 {open}–{close}',
  'wait.checkout': '现在下单，大约 {n} 分钟后可以取', 'wait.ahead': '前面还有 {n} 杯 · 大约 {m} 分钟',
  'wait.next': '马上就轮到你 · 大约 {m} 分钟',
  'loy.title': '集点卡', 'loy.sub': '每买一杯攒 1 个印章，集满 {n} 个免费换一杯。不用注册，用手机号就行。',
  'loy.phonePh': '输入手机号查印章', 'loy.check': '查一下', 'loy.have': '已经攒了 {s} / {n} 个印章',
  'loy.more': '再攒 {k} 个就能免费换一杯', 'loy.ready': '可以免费换一杯了！结账时勾选就行',
  'loy.earn': '留手机号，取餐后这单可以攒 {n} 个印章', 'loy.use': '用 {n} 个印章免费换一杯（−{amt}）',
  'loy.earned': '这一单取餐后为你攒了 {n} 个印章', 'loy.willEarn': '取餐后会为你攒 {n} 个印章',
  'loy.link': '查看我的集点卡', 'loy.badPhone': '手机号好像不对，再检查一下',
  'co.reward': '集点兑换', 'co.coupon': '优惠码', 'co.couponPh': '有优惠码吗？', 'co.apply': '使用', 'co.remove': '移除',
  'err.coupon_invalid': '没有这个优惠码', 'err.coupon_expired': '这个优惠码已经过期了', 'err.coupon_used_up': '这个优惠码已经被用完了',
  'err.coupon_min': '满 {min} 才能用这个优惠码', 'err.coupon_inactive': '这个优惠码暂时不能用',
  'err.not_enough_stamps': '印章不够，换不了免费的一杯', 'err.phone_required': '兑换免费饮品需要填手机号',
  'badge.new': '新品', 'badge.limited': '限定', 'badge.hot': '人气',
  'home.featured': '本季新品与限定',
  'caf.none': '不含咖啡因', 'caf.low': '咖啡因 低', 'caf.mid': '咖啡因 中', 'caf.high': '咖啡因 高',
  'alg.dairy': '含乳制品', 'alg.egg': '含鸡蛋', 'alg.soy': '含大豆', 'alg.gluten': '含麸质', 'alg.nuts': '含坚果', 'alg.sesame': '含芝麻',
  'alg.swap': '可换燕麦奶（无乳）',
  'reorder': '再来一单', 'reorder.done': '已把这一单加入购物车', 'reorder.partly': '有的饮品已售罄，其余的加入购物车了',
  'recent': '最近的订单', 'recent.items': '{n} 杯 · {total}',
  'pwa.install': '安装 App', 'pwa.iosTip': '在 Safari 点下面的"分享"按钮，再选"添加到主屏幕"，就能像 App 一样打开。',
  'pwa.why': '把 {name} 放到手机主屏幕，下次点单一键打开。', 'pwa.installed': '已安装到主屏幕',
});
I18N.extend('en', {
  'store.title': 'Visit us', 'store.address': 'Address', 'store.hours': 'Hours', 'store.phone': 'Phone',
  'store.directions': 'Open in Maps', 'store.open': 'Open now · closes {close}', 'store.closed': 'Closed · opens {open}',
  'store.closedDemo': 'Closed (you can still order in this demo)', 'store.daily': 'Daily {open}–{close}',
  'wait.checkout': 'Order now and it should be ready in about {n} min', 'wait.ahead': '{n} drink(s) ahead of you · about {m} min',
  'wait.next': "You're next · about {m} min",
  'loy.title': 'Stamp card', 'loy.sub': 'Get 1 stamp per drink. Collect {n} for a free one. No sign-up, just your phone number.',
  'loy.phonePh': 'Phone number', 'loy.check': 'Check', 'loy.have': '{s} of {n} stamps',
  'loy.more': '{k} more for a free drink', 'loy.ready': 'You have a free drink! Tick the box at checkout',
  'loy.earn': 'Add your phone to earn {n} stamp(s) when you pick up', 'loy.use': 'Use {n} stamps for a free drink (−{amt})',
  'loy.earned': 'You earned {n} stamp(s) with this order', 'loy.willEarn': "You'll earn {n} stamp(s) at pickup",
  'loy.link': 'See my stamp card', 'loy.badPhone': "That phone number doesn't look right",
  'co.reward': 'Stamp reward', 'co.coupon': 'Promo code', 'co.couponPh': 'Have a code?', 'co.apply': 'Apply', 'co.remove': 'Remove',
  'err.coupon_invalid': "That code doesn't exist", 'err.coupon_expired': 'That code has expired', 'err.coupon_used_up': 'That code has been used up',
  'err.coupon_min': 'This code needs a {min} minimum', 'err.coupon_inactive': "That code isn't active right now",
  'err.not_enough_stamps': 'Not enough stamps for a free drink', 'err.phone_required': 'Add your phone number to use a free drink',
  'badge.new': 'New', 'badge.limited': 'Limited', 'badge.hot': 'Popular',
  'home.featured': 'New & limited this season',
  'caf.none': 'Caffeine-free', 'caf.low': 'Low caffeine', 'caf.mid': 'Medium caffeine', 'caf.high': 'High caffeine',
  'alg.dairy': 'Contains dairy', 'alg.egg': 'Contains egg', 'alg.soy': 'Contains soy', 'alg.gluten': 'Contains gluten', 'alg.nuts': 'Contains nuts', 'alg.sesame': 'Contains sesame',
  'alg.swap': 'Oat milk swap (dairy-free)',
  'reorder': 'Order again', 'reorder.done': 'Added this order to your cart', 'reorder.partly': 'Some drinks are sold out; the rest were added',
  'recent': 'Recent orders', 'recent.items': '{n} drink(s) · {total}',
  'pwa.install': 'Install app', 'pwa.iosTip': 'In Safari, tap Share, then "Add to Home Screen" to open it like an app.',
  'pwa.why': 'Put {name} on your home screen and order in one tap next time.', 'pwa.installed': 'Installed on your home screen',
});
