/* =========================================================
   stripe.js：在线支付（Stripe Checkout）
   流程：
   1. 顾客选"在线支付"下单 → 服务器向 Stripe 创建一个付款页面（Checkout Session）
   2. 浏览器跳到 Stripe 的付款页面，顾客输入银行卡
   3. 付款成功后 Stripe 做两件事：
      - 把顾客送回我们的订单页面（success_url）
      - 给服务器发一个通知（webhook），服务器把订单标记为"已付款"
   银行卡信息只在 Stripe 那边，我们的服务器完全碰不到，这样最安全。

   测试模式：用 sk_test_ 开头的密钥，付款时卡号填 4242 4242 4242 4242，
   有效期填任意未来日期，CVC 任意 3 位数字。不会真的扣钱。
   ========================================================= */
let client = null;
function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!client) client = require('stripe')(process.env.STRIPE_SECRET_KEY);
  return client;
}

const enabled = () => !!process.env.STRIPE_SECRET_KEY;

async function createCheckout({ lineItems, tax, taxName, currency, successUrl, cancelUrl, orderId, number, locale }) {
  const items = lineItems.map(li => ({
    quantity: li.qty,
    price_data: {
      currency: currency.toLowerCase(),
      unit_amount: li.unit,
      product_data: { name: li.name, description: li.description.slice(0, 200) },
    },
  }));
  // 税单独作为一行（价格已经由我们自己的服务器算好）
  if (tax > 0) {
    items.push({ quantity: 1, price_data: { currency: currency.toLowerCase(), unit_amount: tax, product_data: { name: taxName } } });
  }
  return stripe().checkout.sessions.create({
    mode: 'payment',
    line_items: items,
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: orderId,
    metadata: { orderId, number },
    locale: locale === 'en' ? 'en' : 'zh',
    expires_at: Math.floor(Date.now() / 1000) + 35 * 60,   // 35 分钟内没付就作废（Stripe 要求至少 30 分钟）
  });
}

const getSession = id => stripe().checkout.sessions.retrieve(id);

function verifyWebhook(rawBody, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe() || !secret) throw new Error('webhook not configured');
  return stripe().webhooks.constructEvent(rawBody, signature, secret);
}

module.exports = { enabled, createCheckout, getSession, verifyWebhook };
