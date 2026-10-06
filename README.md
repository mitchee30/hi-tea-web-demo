# Hi Tea · Interactive bubble tea demo

Hi Tea 是一家**虚构的奶茶店**，用来演示小店网站可以做出哪些互动功能。价格仅为示例。
Hi Tea is a **fictional bubble tea shop**, built to show what an interactive small-shop website can do. Prices are placeholders.

## 功能 Features

- **在线调一杯 Build your drink**：选茶底、奶、甜度、冰量、小料，SVG 杯子实时变色，珍珠一颗颗掉进杯里，价格实时计算。
  Pick tea, milk, sugar, ice and toppings; the SVG cup recolours live, pearls drop in, price updates instantly.
- **今天喝什么 What should I drink today**：读取 Kitchener-Waterloo 实时天气（Open-Meteo，无需 API key），结合心情给饮品打分，转盘停在推荐的那一杯。
  Reads live Kitchener-Waterloo weather (Open-Meteo, no API key), scores drinks against weather + mood, and spins a wheel to the pick.
- **招牌菜单 Menu**：每杯都能一键载入调制区。Every drink loads its recipe into the builder in one tap.

## 技术 Tech

一个 HTML 文件，原生 JavaScript + SVG，没有框架、没有构建步骤。
A single HTML file: vanilla JavaScript and SVG, no framework, no build step.

- 数据与界面分离：菜单都在脚本顶部的数组里 / Data lives in arrays at the top of the script
- 单一状态对象 + `render()` / One `state` object and a `render()` function
- 尊重 `prefers-reduced-motion`，手机宽度可用 / Respects reduced motion; works at phone width

## 本地运行 Run locally

直接用浏览器打开 `index.html`。Open `index.html` in a browser.

## 作者 Author

Wenbo Zhi · University of Waterloo, Electrical Engineering · [github.com/mitchee30](https://github.com/mitchee30)
