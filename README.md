# Hi Tea · Bubble Tea Ordering System

A full-stack online ordering system for small bubble tea shops: an interactive customer site, a real-time staff dashboard, menu management, table QR ordering and Stripe payments. **Hi Tea is a fictional shop**; the whole thing is a reusable template that can be re-skinned for a real shop by editing one config file.

- **Demo (front end only, demo mode):** https://mitchee30.github.io/hi-tea-web-demo/
- **Full version:** run it locally (below) or deploy to Render

## What it does

**For customers**
- Build a drink with a live animated cup (gradient tea, brown sugar streaks, cheese foam, 3D toppings that drop and pile up), or pick from the signature menu, or let a wheel choose based on live weather and mood
- Cart with several drinks → checkout with pickup time slots → order number
- **Live order status page**: received → making → ready, updates by itself over WebSocket, with a chime, vibration and optional system notification
- Pay at the counter, or online with **Stripe Checkout** (test mode)
- **Scan a table QR code** to order dine-in with the table number filled in
- **Chinese / English** switch for every screen, remembered per device
- Sold-out items update instantly when staff change them
- Lo-fi background music and sound effects, synthesised live with the Web Audio API

**For staff** (`/admin.html`, PIN login)
- Real-time order board: New → Making → Waiting for pickup, with a chime and flashing card for new orders
- One tap moves an order forward and notifies the customer's phone
- **Menu management without touching code**: names (中/EN), prices, sold out, colours, signature drink recipes, add or remove drinks, teas and toppings
- Generate and print table QR codes

## Tech

| Layer | What |
|---|---|
| Front end | Vanilla JavaScript, SVG, CSS; single-page app with hash routing |
| Back end | Node.js, Express REST API |
| Database | SQLite (better-sqlite3) |
| Real time | WebSocket (`ws`): new orders to staff, status to customers, menu changes to everyone |
| Payments | Stripe Checkout + signed webhook |
| Tests | `node:test` API tests; GitHub Actions runs them before every deploy |

Things worth pointing out:
- **The server recomputes every price.** The browser's totals are never trusted, so nobody can edit a request and pay $0.01. Prices are handled in integer cents to avoid floating-point errors. The same `pricing.js` runs in the browser and on the server.
- **Customers can only see their own order**, using a random token from checkout. The public view leaves out phone numbers.
- Order status can only move forward (new → making → ready → done) or be cancelled.
- Times are computed in the shop's time zone (`America/Toronto`), not the server's.
- Rate limiting on ordering and login; constant-time PIN comparison.
- If Stripe is down, the order still goes through as pay-at-counter instead of being lost.

```
public/                 front end (also deployed to GitHub Pages as a demo)
  index.html            customer site
  admin.html            staff dashboard
  shop.config.json      ← the one file to change for another shop
  pricing.js            price rules shared by browser and server
  api.js                talks to the server; falls back to demo mode
  i18n.js               Chinese / English text
  cup.js  sound.js      animated cup, music and sound effects
  script.js  admin.js   page logic
server/
  index.js              routes
  db.js                 SQLite tables
  realtime.js           WebSocket
  stripe.js             Stripe Checkout and webhook
  menu.js               validates menus saved from the dashboard
  time.js               opening hours and pickup slots
test/api.test.js        API tests
```

## Run locally

Requires Node.js 20.12 or newer.

```bash
npm install
cp .env.example .env      # then edit ADMIN_PIN
npm start
```

- Customer site: http://localhost:3000
- Staff dashboard: http://localhost:3000/admin.html (PIN from `.env`, `1234` by default)
- Tests: `npm test`

Tip: open the customer site on your phone (same Wi-Fi, use your computer's IP) and the dashboard on your laptop, then place an order and watch it arrive.

## Stripe test payments

1. Create a free Stripe account and copy the **test** secret key from https://dashboard.stripe.com/test/apikeys into `.env` as `STRIPE_SECRET_KEY`.
2. Restart the server. "Pay online" now appears at checkout.
3. Pay with card `4242 4242 4242 4242`, any future date, any CVC. No real money moves.
4. For webhooks in production, add an endpoint `https://YOUR-SITE/api/stripe/webhook` for the `checkout.session.completed` event and put its signing secret in `STRIPE_WEBHOOK_SECRET`. Locally the order page also checks with Stripe when you come back, so webhooks are optional for testing.

## Deploy

**Full version on Render:** New → Blueprint → pick this repo. Render reads `render.yaml` and asks for `ADMIN_PIN` (and the optional Stripe keys and `PUBLIC_URL`).
Note: on Render's free plan the service sleeps after 15 minutes (the first visit then takes about 30 seconds), and **the disk is not persistent, so the SQLite database resets when the service restarts or redeploys**. That's fine for demos. For a real shop, use a paid instance with a persistent disk and set `DB_PATH` to a file on it.

**Demo on GitHub Pages:** Settings → Pages → Source → **GitHub Actions**. Every push to `main` runs the tests and publishes `public/`. Without a back end the site switches to demo mode by itself: the menu comes from `shop.config.json`, orders stay on the device, and the prep steps are simulated.

## Use it for another shop

Edit `public/shop.config.json`:
- `shop`: name, tagline, address, coordinates (for weather), time zone, tax rate
- `theme`: colours
- `hours`: opening hours, prep time, slot length; set `demoAlwaysOpen` to `false`
- `features`: turn the wheel, music or table ordering on or off
- `menu`: the starting menu (after the first start, the menu is edited in the dashboard)

Delete `data/hitea.db` to reload the menu from the config.

## Author

Wenbo Zhi · University of Waterloo, Electrical Engineering · [github.com/mitchee30](https://github.com/mitchee30)

---

# Hi Tea · 奶茶店点单系统

一套给小奶茶店用的完整线上点单系统：顾客端互动网站、店员实时后台、菜单管理、扫码点单和 Stripe 在线支付。**Hi Tea 是一家虚构的店**。整个项目是一个可以复用的模板，给真实的店使用时，只需要改一个配置文件。

- **演示版（只有前端，演示模式）：** https://mitchee30.github.io/hi-tea-web-demo/
- **完整版：** 按下面的步骤在本地运行，或者部署到 Render

## 功能

**顾客端**
- 自己调一杯：杯子会实时变化，有渐变茶底、黑糖虎纹、奶盖，还有会掉落、堆叠的立体小料；也可以从招牌菜单里挑，或者让转盘根据实时天气和心情帮你选
- 购物车可以点多杯 → 结账时选取餐时间 → 拿到取餐号
- **订单状态实时页**：已下单 → 制作中 → 可以取餐，通过 WebSocket 自动更新，做好时会响铃、震动，还可以发系统通知
- 到店付款，或者用 **Stripe** 在线支付（测试模式）
- **扫桌上二维码点单**，桌号会自动带上
- 所有页面都能**中英文切换**，每台设备会记住自己的选择
- 店员一改售罄，顾客页面马上更新
- lo-fi 背景音乐和音效，用 Web Audio API 现场合成

**店员后台**（`/admin.html`，用 PIN 登录）
- 实时订单看板：已下单 → 制作中 → 等待取餐；新订单会响铃，卡片会闪烁
- 点一下就能推进订单状态，顾客的手机会同步更新
- **不用改代码就能管理菜单**：中英文名字、价格、售罄、颜色、招牌饮品配方，还能增删饮品、茶底和小料
- 生成并打印桌号二维码

## 技术

| 层 | 用了什么 |
|---|---|
| 前端 | 原生 JavaScript、SVG、CSS；用 hash 路由做单页应用 |
| 后端 | Node.js、Express REST API |
| 数据库 | SQLite（better-sqlite3） |
| 实时 | WebSocket（`ws`）：新订单推给店员、状态推给顾客、菜单变化推给所有人 |
| 支付 | Stripe Checkout + 带签名验证的 webhook |
| 测试 | `node:test` 接口测试；每次部署前由 GitHub Actions 自动运行 |

值得一提的设计：
- **价格永远由服务器重新计算**，不相信浏览器发来的金额，别人改请求也没法用 0.01 元下单。金额用"分"（整数）计算，避免小数误差。浏览器和服务器共用同一份 `pricing.js`。
- **顾客只能看到自己的订单**：下单时会拿到一个随机 token，查订单必须带上它。顾客看到的订单信息里不包含电话号码。
- 订单状态只能按顺序往前走（已下单 → 制作中 → 可以取餐 → 已取餐），或者被取消。
- 营业时间和取餐时间按店铺所在时区（`America/Toronto`）计算，而不是服务器的时区。
- 下单和登录接口有限流；PIN 比较用的是常数时间比较。
- Stripe 出问题时，订单会自动改成到店付款，不会丢单。

## 本地运行

需要 Node.js 20.12 或更新的版本。

```bash
npm install
cp .env.example .env      # 然后修改里面的 ADMIN_PIN
npm start
```

- 顾客端：http://localhost:3000
- 店员后台：http://localhost:3000/admin.html（PIN 在 `.env` 里，默认是 `1234`）
- 运行测试：`npm test`

小技巧：手机和电脑连同一个 Wi-Fi，手机上用电脑的 IP 打开顾客端，电脑上打开店员后台。然后用手机下一单，看着订单出现在后台。

## Stripe 测试支付

1. 注册一个免费的 Stripe 账号，在 https://dashboard.stripe.com/test/apikeys 复制**测试模式**的 secret key，填到 `.env` 的 `STRIPE_SECRET_KEY`。
2. 重启服务器，结账页面就会出现"在线支付"。
3. 卡号填 `4242 4242 4242 4242`，有效期填任意未来日期，CVC 填任意 3 位数字。不会真的扣钱。
4. 正式上线时，在 Stripe 后台添加 webhook，地址是 `https://你的网址/api/stripe/webhook`，事件选 `checkout.session.completed`，再把签名密钥填到 `STRIPE_WEBHOOK_SECRET`。本地测试时，从 Stripe 付款页回到订单页时，服务器会主动向 Stripe 确认付款状态，所以不配置 webhook 也能测试。

## 部署

**完整版部署到 Render：** 选 New → Blueprint，再选这个仓库。Render 会读取 `render.yaml`，并让你填写 `ADMIN_PIN`（以及可选的 Stripe 密钥和 `PUBLIC_URL`）。
注意：Render 免费版 15 分钟没人访问就会休眠，之后第一次打开要等大约 30 秒；而且**免费版的硬盘不能长期保存数据，服务器每次重启或重新部署，SQLite 数据库都会清空**。拿来演示没问题。给真实的店用时，需要换成带持久硬盘的付费实例，并把 `DB_PATH` 指到那块硬盘上的文件。

**演示版部署到 GitHub Pages：** 在 Settings → Pages → Source 里选 **GitHub Actions**。之后每次推送到 `main`，都会先自动跑测试，再发布 `public/` 文件夹。没有后端时，网站会自动进入演示模式：菜单从 `shop.config.json` 读取，订单只存在这台设备上，制作过程是模拟的。

## 给另一家店用

修改 `public/shop.config.json`：
- `shop`：店名、标语、地址、坐标（用来查天气）、时区、税率
- `theme`：配色
- `hours`：营业时间、准备时间、取餐时间的间隔；记得把 `demoAlwaysOpen` 改成 `false`
- `features`：开关转盘、背景音乐和扫码点单功能
- `menu`：初始菜单（第一次启动后，菜单就在店员后台修改）

删除 `data/hitea.db`，就能重新从配置文件加载菜单。

## 作者

Wenbo Zhi · 滑铁卢大学电子工程专业 · [github.com/mitchee30](https://github.com/mitchee30)
