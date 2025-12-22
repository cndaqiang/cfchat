# 技术方案与数据流

## 🧩 组件
- **Worker 入口**：负责页面渲染与 WebSocket 路由
- **Durable Object (ChatRoom)**：仅做实时广播转发，不保存消息
- **前端页面**：密钥派生、加解密、渲染与本地文本记录

## 🔐 密钥与房间
- **房间指纹**：`SHA-256(password)` → 64 位 hex
- **加密密钥**：对同一 `password` 做 `SHA-256` 并导入为 AES-GCM
- 同一密钥进入同一房间，才能解密

## 🔁 数据流
1. 用户输入密钥 → 派生 roomId 与 cryptoKey
2. 建立 `wss://host/ws/:roomId` 实时连接
3. 文本/图片 AES-GCM 加密 → WebSocket 发送
4. Durable Object 广播到同房间客户端
5. 接收端使用相同密钥解密并渲染

## 🧪 消息格式（简化）
```json
{
  "v": 1,
  "type": "text|image",
  "sender": "uuid",
  "time": 1710000000000,
  "iv": "base64",
  "data": "base64",
  "name": "image.png",
  "mime": "image/png",
  "size": 123456
}
```

## 🧱 限制
- 单条消息上限约 1MB（WebSocket 文本帧）
- 图片默认限制 512KB，可在前端调整
