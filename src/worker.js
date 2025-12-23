/**
 * Cloudflare Workers - 实时加密消息
 * 仅转发，不存储；消息只保存在浏览器本地
 */

// ============================================
// 路由说明
// /          - 页面
// /ws/:room  - WebSocket 实时通道（room 为密钥派生的指纹）
// /health    - 健康检查
// ============================================

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      if (pathname === '/health') {
        return createJSONResponse({ status: 'ok', timestamp: new Date().toISOString() });
      }

      if (pathname === '/') {
        return createHomeResponse();
      }

      if (pathname.startsWith('/ws/')) {
        return await handleWebSocket(request, env, pathname);
      }

      return createErrorResponse('Not Found', 404, 'Supported routes: /, /ws/:room, /health');
    } catch (error) {
      return createErrorResponse('Internal Server Error', 500, error.message);
    }
  }
};

/**
 * WebSocket Durable Object：只做转发，不做任何存储
 */
export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.maxMessageSize = 1000000;
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return createErrorResponse('Bad Request', 400, 'Expected WebSocket upgrade');
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.state.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  webSocketMessage(ws, message) {
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message);

    if (text.length > this.maxMessageSize) {
      ws.close(1009, 'Message too large');
      return;
    }

    const sockets = this.state.getWebSockets();
    for (const socket of sockets) {
      if (socket !== ws) {
        try {
          socket.send(text);
        } catch (error) {
          // 忽略已关闭的连接
        }
      }
    }
  }

  webSocketClose(ws, code, reason, wasClean) {
    // 无需清理持久状态
  }

  webSocketError(ws, error) {
    // 忽略错误，避免影响其他连接
  }
}

async function handleWebSocket(request, env, pathname) {
  const roomId = pathname.slice('/ws/'.length);

  if (!isValidRoomId(roomId)) {
    return createErrorResponse('Bad Request', 400, 'Invalid room id');
  }

  const id = env.CHAT_ROOM.idFromName(roomId);
  const stub = env.CHAT_ROOM.get(id);
  return await stub.fetch(request);
}

function isValidRoomId(roomId) {
  return /^[a-f0-9]{64}$/i.test(roomId);
}

/**
 * 创建JSON响应
 */
function createJSONResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status: status,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

/**
 * 创建错误响应
 */
function createErrorResponse(message, status = 500, details = null) {
  const error = {
    error: message,
    code: status,
    timestamp: new Date().toISOString()
  };

  if (details) {
    error.details = details;
  }

  return createJSONResponse(error, status);
}

/**
 * 创建首页
 */
function createHomeResponse() {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>%E2%98%81%EF%B8%8F</text></svg>">
  <title>密钥消息</title>
  <style>
    :root {
      --bg-1: #fff2d8;
      --bg-2: #f6e5ff;
      --bg-3: #d7f5ff;
      --ink: #1a1a1a;
      --muted: #5f6b6d;
      --card: #fffaf3;
      --accent: #f15a29;
      --accent-2: #1982c4;
      --line: rgba(0, 0, 0, 0.08);
      --shadow: 0 24px 60px rgba(17, 24, 39, 0.16);
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Trebuchet MS", "Lucida Sans", "Lucida Grande", Verdana, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(1200px 600px at -20% -10%, var(--bg-2), transparent 60%),
        radial-gradient(1000px 700px at 120% 10%, var(--bg-3), transparent 55%),
        linear-gradient(135deg, #fff7ea 0%, #fff1f5 50%, #eef9ff 100%);
      min-height: 100vh;
      padding: 28px;
    }

    .stage {
      max-width: 960px;
      margin: 0 auto;
      display: grid;
      gap: 20px;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 22px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(10px);
      border: 1px solid var(--line);
      box-shadow: var(--shadow);
    }

    header h1 {
      font-size: 26px;
      margin: 0;
      letter-spacing: 0.5px;
    }

    header .tag {
      padding: 6px 12px;
      border-radius: 999px;
      background: #ffe2d6;
      color: #9b2c10;
      font-size: 12px;
      font-weight: 600;
    }

    .panel {
      display: grid;
      grid-template-columns: minmax(240px, 320px) 1fr;
      gap: 18px;
    }

    .card {
      background: var(--card);
      border-radius: 18px;
      padding: 18px;
      border: 1px solid var(--line);
      box-shadow: var(--shadow);
    }

    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 12px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    .field label {
      font-size: 13px;
      font-weight: 600;
      color: var(--muted);
    }

    .field input,
    .field textarea {
      width: 100%;
      border: 2px solid transparent;
      border-radius: 14px;
      padding: 12px 14px;
      font-size: 14px;
      background: #ffffff;
      transition: border 0.2s ease, box-shadow 0.2s ease;
    }

    .field input:focus,
    .field textarea:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(241, 90, 41, 0.18);
    }

    .password-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .password-row input {
      flex: 1;
    }

    .toggle-btn {
      border: none;
      padding: 10px 12px;
      border-radius: 12px;
      background: #fff1e5;
      color: #9b2c10;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 12px;
      background: #f5f5f5;
      font-size: 13px;
      color: var(--muted);
    }

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #cbd5e1;
    }

    .status.connected .dot { background: #10b981; }
    .status.connecting .dot { background: #f59e0b; }
    .status.disconnected .dot { background: #ef4444; }

    .fingerprint {
      margin-top: 8px;
      font-size: 12px;
      color: var(--muted);
      word-break: break-all;
    }

    .chat {
      display: flex;
      flex-direction: column;
      gap: 14px;
      height: 100%;
    }

    .messages {
      flex: 1;
      overflow-y: auto;
      max-height: 420px;
      padding-right: 6px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 12px 14px;
      border-radius: 16px;
      background: #ffffff;
      border: 1px solid var(--line);
    }

    .message.mine {
      align-self: flex-end;
      background: #ffe9df;
      border-color: rgba(241, 90, 41, 0.2);
    }

    .message .meta {
      font-size: 11px;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .message .meta-right {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .message-copy {
      border: none;
      padding: 4px 10px;
      border-radius: 999px;
      background: #f1f5f9;
      color: #475569;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }

    .message .text {
      font-size: 14px;
      white-space: pre-wrap;
    }

    .message .media {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .message .media img {
      max-width: 240px;
      border-radius: 12px;
      border: 1px solid var(--line);
    }

    .message .media a {
      color: var(--accent-2);
      font-weight: 600;
      font-size: 12px;
      text-decoration: none;
    }

    .message .media .meta-line {
      font-size: 11px;
      color: var(--muted);
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .file-card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px;
      border-radius: 12px;
      background: #f8fafc;
      border: 1px solid var(--line);
    }

    .file-name {
      font-size: 13px;
      font-weight: 600;
    }

    .file-meta {
      font-size: 11px;
      color: var(--muted);
    }

    .file-download {
      color: var(--accent-2);
      font-weight: 600;
      font-size: 12px;
      text-decoration: none;
    }
    .composer {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .actions {
      display: flex;
      gap: 10px;
    }

    .btn {
      border: none;
      padding: 12px 16px;
      border-radius: 14px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .btn.primary {
      background: var(--accent);
      color: #fff;
      box-shadow: 0 12px 30px rgba(241, 90, 41, 0.25);
      flex: 1;
    }

    .btn.secondary {
      background: #e8f4ff;
      color: #0f172a;
    }

    .btn:active {
      transform: translateY(1px);
    }

    .notice {
      min-height: 18px;
      font-size: 12px;
      color: var(--muted);
    }

    .tips {
      margin-top: 12px;
      font-size: 12px;
      color: var(--muted);
      line-height: 1.5;
    }

    .footer {
      text-align: center;
      font-size: 12px;
      color: var(--muted);
      margin-top: 12px;
    }

    .footer a {
      color: var(--accent-2);
      text-decoration: none;
      font-weight: 600;
    }

    .footer a:hover {
      text-decoration: underline;
    }

    @media (max-width: 840px) {
      body { padding: 18px; }
      header { flex-direction: column; align-items: flex-start; gap: 6px; }
      .panel { grid-template-columns: 1fr; }
      .messages { max-height: 320px; }
    }
  </style>
</head>
<body>
  <div class="stage">
    <header>
      <div>
        <h1>密钥消息</h1>
        <div class="tips">消息只在浏览器本地保存，Worker 只做实时转发。</div>
      </div>
      <div class="tag">无记录 · 端到端</div>
    </header>

    <div class="panel">
      <aside class="card">
        <div class="section-title">密钥设置</div>
        <div class="field">
          <label for="secretInput">共享密钥</label>
          <div class="password-row">
            <input id="secretInput" type="password" placeholder="留空默认 noset">
            <button id="toggleSecret" class="toggle-btn" type="button">显示</button>
          </div>
        </div>
        <div id="status" class="status disconnected">
          <div class="dot"></div>
          <span id="statusText">等待密钥</span>
        </div>
        <div id="fingerprint" class="fingerprint">指纹：未生成</div>
        <div class="tips">
          密钥用于生成房间指纹并加密消息，只有相同密钥才能解密。
        </div>
      </aside>

      <section class="card chat">
        <div class="section-title">实时消息</div>
        <div id="messages" class="messages"></div>
        <div class="composer">
          <div class="field">
            <label for="messageInput">发送消息</label>
            <textarea id="messageInput" rows="3" placeholder="输入内容，Enter 发送，Shift+Enter 换行"></textarea>
          </div>
          <input id="fileInput" type="file" hidden>
          <div class="actions">
            <button id="sendBtn" class="btn primary">发送</button>
            <button id="fileBtn" class="btn secondary" type="button">文件</button>
            <button id="clearBtn" class="btn secondary" type="button">清空本地</button>
          </div>
          <div id="limitTip" class="tips"></div>
          <div id="notice" class="notice"></div>
        </div>
      </section>
    </div>
    <div class="footer">
      <span>Cloudflare Workers · </span>
      <a href="https://github.com/cndaqiang/cfchat" target="_blank" rel="noopener">GitHub</a>
    </div>
  </div>

  <script>
    const STORAGE_PASSWORD = 'cfchat.password';
    const STORAGE_CLIENT_ID = 'cfchat.clientId';
    const STORAGE_MESSAGES_PREFIX = 'cfchat.messages.';
    const DEFAULT_PASSWORD = 'noset';
    const MAX_HISTORY = 200;
    const MAX_FILE_BYTES = 5 * 1024 * 1024;
    const MAX_CHUNK_BYTES = 240 * 1024;
    const CHUNK_TTL = 2 * 60 * 1000;

    const secretInput = document.getElementById('secretInput');
    const messageInput = document.getElementById('messageInput');
    const toggleSecret = document.getElementById('toggleSecret');
    const sendBtn = document.getElementById('sendBtn');
    const fileBtn = document.getElementById('fileBtn');
    const fileInput = document.getElementById('fileInput');
    const clearBtn = document.getElementById('clearBtn');
    const messagesEl = document.getElementById('messages');
    const statusEl = document.getElementById('status');
    const statusText = document.getElementById('statusText');
    const fingerprintEl = document.getElementById('fingerprint');
    const noticeEl = document.getElementById('notice');
    const limitTip = document.getElementById('limitTip');

    let clientId = sessionStorage.getItem(STORAGE_CLIENT_ID);
    if (!clientId) {
      clientId = crypto.randomUUID();
      sessionStorage.setItem(STORAGE_CLIENT_ID, clientId);
    }

    let cryptoKey = null;
    let currentRoomId = '';
    let currentPassword = '';
    let ws = null;
    let reconnectTimer = null;
    let messageStore = [];
    let passwordTimer = null;
    let passwordVersion = 0;
    const incomingChunks = new Map();

    function setStatus(state, text) {
      statusEl.className = 'status ' + state;
      statusText.textContent = text;
    }

    function showNotice(text) {
      noticeEl.textContent = text;
      if (!text) return;
      clearTimeout(noticeEl._timer);
      noticeEl._timer = setTimeout(() => {
        noticeEl.textContent = '';
      }, 2200);
    }

    function normalizePassword(value) {
      const trimmed = (value || '').trim();
      return trimmed ? trimmed : DEFAULT_PASSWORD;
    }

    function copyToClipboard(text) {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
      }
      return new Promise((resolve, reject) => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '0';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        ok ? resolve() : reject(new Error('copy failed'));
      });
    }
    function storageKey(roomId) {
      return STORAGE_MESSAGES_PREFIX + roomId;
    }

    function saveHistory() {
      if (!currentRoomId) return;
      const trimmed = messageStore
        .filter((item) => (item.type || 'text') === 'text')
        .slice(-MAX_HISTORY);
      localStorage.setItem(storageKey(currentRoomId), JSON.stringify(trimmed));
    }

    function loadHistory() {
      messagesEl.innerHTML = '';
      messageStore = [];
      if (!currentRoomId) return;

      const raw = localStorage.getItem(storageKey(currentRoomId));
      if (!raw) return;

      try {
        messageStore = JSON.parse(raw) || [];
      } catch (error) {
        messageStore = [];
      }

      renderHistory();
    }

    async function renderHistory() {
      messagesEl.innerHTML = '';
      for (const item of messageStore) {
        const text = await decryptText(item).catch(() => null);
        addTextMessage(text, item.time, item.mine, !text);
      }
      scrollToBottom();
    }

    function scrollToBottom() {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    async function applyPassword(rawPassword) {
      const password = normalizePassword(rawPassword);
      if (password === currentPassword && cryptoKey && currentRoomId) {
        return;
      }

      const version = ++passwordVersion;
      currentPassword = password;
      localStorage.setItem(STORAGE_PASSWORD, password);

      const derivedKey = await deriveKey(password);
      if (version !== passwordVersion) return;
      cryptoKey = derivedKey;

      const roomId = await hashRoomId(password);
      if (version !== passwordVersion) return;
      currentRoomId = roomId;
      fingerprintEl.textContent = '指纹：' + currentRoomId.slice(0, 12);

      loadHistory();
      connect();
    }

    function connect() {
      if (!currentRoomId) return;
      if (ws) {
        ws.close(1000, 'switch');
      }

      const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
      const url = protocol + '://' + location.host + '/ws/' + currentRoomId;

      setStatus('connecting', '连接中');
      const socket = new WebSocket(url);
      ws = socket;

      socket.addEventListener('open', () => {
        if (ws !== socket) return;
        setStatus('connected', '实时连接中');
      });

      socket.addEventListener('message', (event) => {
        if (ws !== socket) return;
        handleIncoming(event.data);
      });

      socket.addEventListener('close', () => {
        if (ws !== socket) return;
        if (currentRoomId) {
          setStatus('disconnected', '已断开，尝试重连');
          scheduleReconnect();
        }
      });

      socket.addEventListener('error', () => {
        if (ws !== socket) return;
        setStatus('disconnected', '连接错误');
      });
    }

    function disconnect() {
      if (ws) {
        ws.close(1000, 'disconnect');
        ws = null;
      }
      clearTimeout(reconnectTimer);
    }

    function scheduleReconnect() {
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        connect();
      }, 2000);
    }

    async function handleIncoming(raw) {
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch (error) {
        return;
      }

      if (!payload || payload.sender === clientId) return;
      if (!payload.data || !payload.iv) return;

      const payloadType = typeof payload.type === 'string' ? payload.type.toLowerCase() : '';

      if (payloadType === 'image_chunk' || payloadType === 'file_chunk') {
        await handleFileChunk(payload);
        return;
      }

      if (payloadType === 'file' || payloadType === 'image') {
        const bytes = await decryptBytes(payload).catch(() => null);
        if (!bytes) {
          addFileMessage(null, payload.time, false, payload, true);
          scrollToBottom();
          return;
        }

        const mime = payload.mime || (payloadType === 'image' ? 'image/png' : 'application/octet-stream');
        const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
        const meta = {
          name: payload.name || '文件',
          size: payload.size || bytes.length,
          mime: mime
        };

        addFileMessage(url, payload.time, false, meta, false);
        scrollToBottom();
        return;
      }
      if (payloadType && payloadType !== 'text') {
        addTextMessage('未知消息类型', payload.time, false, true);
        scrollToBottom();
        return;
      }

      const text = await decryptText(payload).catch(() => null);
      addTextMessage(text, payload.time, false, !text);

      messageStore.push({ ...payload, type: 'text', mine: false });
      saveHistory();
      scrollToBottom();
    }

    async function sendMessage() {
      const text = messageInput.value.trim();
      if (!text) return;

      if (!cryptoKey || !currentRoomId) {
        showNotice('请先输入密钥');
        return;
      }

      if (!ws || ws.readyState !== WebSocket.OPEN) {
        showNotice('连接未就绪，稍后再试');
        return;
      }

      const encrypted = await encryptText(text);
      const payload = {
        v: 1,
        type: 'text',
        sender: clientId,
        time: Date.now(),
        iv: encrypted.iv,
        data: encrypted.data
      };

      ws.send(JSON.stringify(payload));

      messageStore.push({ ...payload, mine: true });
      saveHistory();
      addTextMessage(text, payload.time, true, false);
      messageInput.value = '';
      scrollToBottom();
    }

    async function sendFile(file) {
      if (!file) return;

      if (file.size > MAX_FILE_BYTES) {
        showNotice('文件过大，最大 ' + formatBytes(MAX_FILE_BYTES));
        return;
      }

      if (!cryptoKey || !currentRoomId) {
        showNotice('请先输入密钥');
        return;
      }

      if (!ws || ws.readyState !== WebSocket.OPEN) {
        showNotice('连接未就绪，稍后再试');
        return;
      }

      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const time = Date.now();
      const payloadMeta = {
        name: file.name || '文件',
        mime: file.type || 'application/octet-stream',
        size: bytes.length
      };

      if (bytes.length <= MAX_CHUNK_BYTES) {
        const encrypted = await encryptBytes(bytes);
        const payload = {
          v: 1,
          type: 'file',
          sender: clientId,
          time: time,
          iv: encrypted.iv,
          data: encrypted.data,
          name: payloadMeta.name,
          mime: payloadMeta.mime,
          size: payloadMeta.size
        };

        ws.send(JSON.stringify(payload));
      } else {
        await sendFileInChunks(bytes, payloadMeta, time);
      }

      const url = URL.createObjectURL(file);
      addFileMessage(url, time, true, payloadMeta, false);
      scrollToBottom();
    }

    async function sendFileInChunks(bytes, meta, time) {
      const id = crypto.randomUUID();
      const total = Math.ceil(bytes.length / MAX_CHUNK_BYTES);

      for (let index = 0; index < total; index += 1) {
        const start = index * MAX_CHUNK_BYTES;
        const end = Math.min(start + MAX_CHUNK_BYTES, bytes.length);
        const slice = bytes.slice(start, end);
        const encrypted = await encryptBytes(slice);
        const payload = {
          v: 1,
          type: 'file_chunk',
          sender: clientId,
          time: time,
          id: id,
          index: index,
          total: total,
          iv: encrypted.iv,
          data: encrypted.data,
          name: meta.name,
          mime: meta.mime,
          size: meta.size
        };

        ws.send(JSON.stringify(payload));
      }
    }

    async function handleFileFiles(files) {
      const list = Array.from(files || []);
      for (const file of list) {
        await sendFile(file);
      }
    }
    function createChunkState(payload) {
      if (!payload || typeof payload.id !== 'string') return null;
      const total = payload.total;
      if (!Number.isInteger(total) || total <= 0) return null;

      const state = {
        total: total,
        received: 0,
        chunks: new Array(total),
        meta: {
          name: payload.name || '文件',
          mime: payload.mime || 'application/octet-stream',
          size: payload.size || 0,
          time: payload.time || Date.now()
        },
        timer: null
      };

      state.timer = setTimeout(() => {
        incomingChunks.delete(payload.id);
      }, CHUNK_TTL);

      incomingChunks.set(payload.id, state);
      return state;
    }

    async function handleFileChunk(payload) {
      if (!payload || typeof payload.id !== 'string') return;
      const total = payload.total;
      const index = payload.index;

      if (!Number.isInteger(total) || total <= 0) return;
      if (!Number.isInteger(index) || index < 0 || index >= total) return;

      let state = incomingChunks.get(payload.id);
      if (!state) {
        state = createChunkState(payload);
      }
      if (!state || state.total !== total) return;
      if (state.chunks[index]) return;

      const bytes = await decryptBytes(payload).catch(() => null);
      if (!bytes) {
        incomingChunks.delete(payload.id);
        addFileMessage(null, payload.time, false, payload, true);
        scrollToBottom();
        return;
      }

      state.chunks[index] = bytes;
      state.received += 1;

      if (state.received !== state.total) return;

      clearTimeout(state.timer);
      incomingChunks.delete(payload.id);

      if (state.chunks.some((chunk) => !chunk)) {
        return;
      }

      const totalBytes = state.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const merged = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of state.chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }

      const mime = state.meta.mime || 'application/octet-stream';
      const url = URL.createObjectURL(new Blob([merged], { type: mime }));
      const payloadMeta = {
        name: state.meta.name,
        size: state.meta.size,
        mime: mime
      };

      addFileMessage(url, state.meta.time, false, payloadMeta, false);
      scrollToBottom();
    }
    function addTextMessage(text, time, mine, failed) {
      const item = document.createElement('div');
      item.className = 'message' + (mine ? ' mine' : '');

      const meta = document.createElement('div');
      meta.className = 'meta';
      const timestamp = new Date(time || Date.now()).toLocaleTimeString();

      const metaLeft = document.createElement('span');
      metaLeft.textContent = mine ? '我' : '同伴';

      const metaRight = document.createElement('div');
      metaRight.className = 'meta-right';

      const timeSpan = document.createElement('span');
      timeSpan.textContent = timestamp;

      const copyBtn = document.createElement('button');
      copyBtn.className = 'message-copy';
      copyBtn.type = 'button';
      copyBtn.textContent = '复制';

      const rawText = typeof text === 'string' ? text : '';
      copyBtn.addEventListener('click', async () => {
        if (failed || !rawText) {
          showNotice('没有可复制的内容');
          return;
        }
        try {
          await copyToClipboard(rawText);
          showNotice('消息已复制');
        } catch (error) {
          showNotice('复制失败');
        }
      });

      metaRight.appendChild(timeSpan);
      metaRight.appendChild(copyBtn);
      meta.appendChild(metaLeft);
      meta.appendChild(metaRight);

      const content = document.createElement('div');
      content.className = 'text';
      content.textContent = failed ? '无法解密（密钥不一致）' : (text || '');

      item.appendChild(meta);
      item.appendChild(content);
      messagesEl.appendChild(item);
    }


    function addFileMessage(url, time, mine, payload, failed) {
      const item = document.createElement('div');
      item.className = 'message' + (mine ? ' mine' : '');

      const meta = document.createElement('div');
      meta.className = 'meta';
      const timestamp = new Date(time || Date.now()).toLocaleTimeString();
      meta.innerHTML = '<span>' + (mine ? '我' : '同伴') + '</span><span>' + timestamp + '</span>';

      item.appendChild(meta);

      const card = document.createElement('div');
      card.className = 'file-card';

      if (failed || !url) {
        const failedText = document.createElement('div');
        failedText.className = 'text';
        failedText.textContent = '文件无法解密（密钥不一致）';
        card.appendChild(failedText);
        item.appendChild(card);
        messagesEl.appendChild(item);
        return;
      }

      const name = payload && payload.name ? payload.name : '文件';
      const nameEl = document.createElement('div');
      nameEl.className = 'file-name';
      nameEl.textContent = name;

      const metaEl = document.createElement('div');
      metaEl.className = 'file-meta';
      metaEl.textContent = payload && typeof payload.size === 'number' ? formatBytes(payload.size) : '未知大小';

      const download = document.createElement('a');
      download.className = 'file-download';
      download.href = url;
      download.download = name;
      download.textContent = '下载';

      card.appendChild(nameEl);
      card.appendChild(metaEl);
      card.appendChild(download);
      item.appendChild(card);
      messagesEl.appendChild(item);
    }
    function formatBytes(bytes) {
      if (!bytes) return '0 B';
      const units = ['B', 'KB', 'MB'];
      let size = bytes;
      let unitIndex = 0;
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
      }
      return size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1) + ' ' + units[unitIndex];
    }

    function updateLimitTip() {
      if (!limitTip) return;
      limitTip.textContent = '文件最大 ' + formatBytes(MAX_FILE_BYTES);
    }

    async function encryptBytes(bytes) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, bytes);
      return {
        iv: bytesToBase64(iv),
        data: bytesToBase64(new Uint8Array(cipher))
      };
    }

    async function decryptBytes(payload) {
      if (!cryptoKey) return null;
      const iv = base64ToBytes(payload.iv);
      const data = base64ToBytes(payload.data);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
      return new Uint8Array(plain);
    }

    async function encryptText(text) {
      const encoded = new TextEncoder().encode(text);
      return encryptBytes(encoded);
    }

    async function decryptText(payload) {
      const bytes = await decryptBytes(payload);
      if (!bytes) return null;
      return new TextDecoder().decode(bytes);
    }

    async function deriveKey(password) {
      const encoded = new TextEncoder().encode(password);
      const hash = await crypto.subtle.digest('SHA-256', encoded);
      return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
    }

    async function hashRoomId(password) {
      const encoded = new TextEncoder().encode(password);
      const hash = await crypto.subtle.digest('SHA-256', encoded);
      return bytesToHex(new Uint8Array(hash));
    }

    function bytesToHex(bytes) {
      return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    function bytesToBase64(bytes) {
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      return btoa(binary);
    }

    function base64ToBytes(base64) {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });

    messageInput.addEventListener('paste', (event) => {
      const items = event.clipboardData && event.clipboardData.items;
      if (!items) return;
      const files = [];
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length) {
        event.preventDefault();
        handleFileFiles(files);
      }
    });

    fileInput.addEventListener('change', async (event) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;
      await handleFileFiles(files);
      fileInput.value = '';
    });
    clearBtn.addEventListener('click', () => {
      if (!currentRoomId) return;
      localStorage.removeItem(storageKey(currentRoomId));
      messageStore = [];
      messagesEl.innerHTML = '';
      showNotice('本地记录已清空');
    });

    secretInput.addEventListener('input', () => {
      const value = secretInput.value;
      clearTimeout(passwordTimer);
      passwordTimer = setTimeout(() => {
        applyPassword(value);
      }, 500);
    });

    secretInput.addEventListener('blur', () => {
      const value = secretInput.value;
      applyPassword(value);
    });

    toggleSecret.addEventListener('click', () => {
      const isHidden = secretInput.type === 'password';
      secretInput.type = isHidden ? 'text' : 'password';
      toggleSecret.textContent = isHidden ? '隐藏' : '显示';
    });
    fileBtn.addEventListener('click', () => {
      fileInput.value = '';
      fileInput.click();
    });

    const stored = localStorage.getItem(STORAGE_PASSWORD);
    const initialPassword = stored || DEFAULT_PASSWORD;
    if (stored && stored !== DEFAULT_PASSWORD) {
      secretInput.value = stored;
    }
    applyPassword(initialPassword);
    updateLimitTip();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'no-store'
    }
  });
}
