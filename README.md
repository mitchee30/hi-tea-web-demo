# Hi Tea · Interactive Bubble Tea Demo

Hi Tea is a **fictional bubble tea shop**, built to show what an interactive small-shop website can do. Prices are placeholders.

## Features

- **Build your drink**: pick tea, milk, sugar, ice and toppings. The SVG cup recolours live, pearls drop in one by one, and the price updates instantly.
- **What should I drink today?**: reads live Kitchener-Waterloo weather (Open-Meteo, no API key needed), scores each drink against the weather and your mood, then spins a wheel to the pick.
- **Menu**: every drink loads its recipe into the builder in one tap.

## Tech

A single HTML file: vanilla JavaScript and SVG, with no framework and no build step.

- Data and UI are separate: the whole menu lives in arrays at the top of the script
- One `state` object and one `render()` function drive the page
- Respects `prefers-reduced-motion` and works at phone width

## Run locally

Open `index.html` in any browser.

## Author

Wenbo Zhi · University of Waterloo, Electrical Engineering · [github.com/mitchee30](https://github.com/mitchee30)

---

# Hi Tea · 互动奶茶店示例网站

Hi Tea 是一家**虚构的奶茶店**，用来演示小店网站可以做出哪些互动功能。价格仅为示例。

## 功能

- **在线调一杯**：选择茶底、奶、甜度、冰量和小料，SVG 杯子会实时变色，珍珠一颗颗掉进杯里，价格同步计算。
- **今天喝什么**：读取 Kitchener-Waterloo 的实时天气（使用 Open-Meteo，不需要 API key），结合你的心情给每杯饮品打分，转盘停在推荐的那一杯。
- **招牌菜单**：每杯饮品都能一键载入调制区。

## 技术

只有一个 HTML 文件，用原生 JavaScript 和 SVG 编写，不需要框架，也不需要构建步骤。

- 数据和界面分离：整个菜单都写在脚本顶部的数组里
- 由一个 `state` 状态对象和一个 `render()` 函数驱动整个页面
- 支持"减少动态效果"系统设置，手机上也能正常显示

## 本地运行

用任意浏览器打开 `index.html` 即可。

## 作者

Wenbo Zhi · 滑铁卢大学电子工程专业 · [github.com/mitchee30](https://github.com/mitchee30)
