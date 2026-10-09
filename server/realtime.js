/* =========================================================
   realtime.js：实时推送（WebSocket）
   普通网页是"浏览器问，服务器答"。WebSocket 是一条一直开着的连接，
   服务器有新消息时可以主动推给浏览器：
   - 顾客下单 → 店员后台立刻出现新订单
   - 店员点"完成" → 顾客手机上立刻显示"可以取餐了"
   - 店员改了菜单（比如珍珠售罄）→ 所有顾客的页面立刻更新
   ========================================================= */
const { WebSocketServer } = require('ws');

function createRealtime(server, { isStaffToken, checkOrderToken }) {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });

  wss.on('connection', ws => {
    ws.isAlive = true;
    ws.role = 'guest';
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', raw => {
      let msg;
      try { msg = JSON.parse(raw); } catch (e) { return; }
      // 店员：带上登录后拿到的 token，验证通过才能收到所有订单
      if (msg.type === 'staff' && isStaffToken(msg.token)) {
        ws.role = 'staff';
        ws.send(JSON.stringify({ type: 'ready', role: 'staff' }));
      }
      // 顾客：只能订阅自己的那一单（要有订单的 token）
      if (msg.type === 'track' && checkOrderToken(msg.id, msg.token)) {
        ws.trackId = msg.id;
        ws.send(JSON.stringify({ type: 'ready', role: 'track' }));
      }
    });
  });

  // 每 30 秒检查一次连接，断掉的清理掉
  const timer = setInterval(() => {
    wss.clients.forEach(ws => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
  wss.on('close', () => clearInterval(timer));

  const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };

  return {
    // 订单有变化：发给所有店员（完整信息）和正在看这一单的顾客（公开信息）
    orderChanged(staffView, publicView) {
      wss.clients.forEach(ws => {
        if (ws.role === 'staff') send(ws, { type: 'order', order: staffView });
        else if (ws.trackId === publicView.id) send(ws, { type: 'order', order: publicView });
      });
    },
    // 菜单改了：通知所有人重新拿菜单
    menuChanged() {
      wss.clients.forEach(ws => send(ws, { type: 'menu' }));
    },
  };
}

module.exports = { createRealtime };
