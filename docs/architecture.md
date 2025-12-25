# 技术方案与数据流

## 架构组件
- **Worker 入口**：负责页面渲染与 WebSocket 路由
- **Durable Object (ChatRoom)**：只做实时广播转发，不保存消息
- **前端页面**：密钥派生、加解密、渲染、文件下载和本地历史管理

## 路由说明
| 路由 | 说明 |
| --- | --- |
| `/` | 首页，呈现密钥设置、消息区域和文件下载列表 |
| `/ws/:room` | WebSocket 实时通道；`:room` 由密钥 `SHA-256(password)` 派生的 64 位 hex |
| `/health` | 健康检查接口 |

> Worker 只接受带 `Upgrade: websocket` 的 `/ws/:room` 请求，不做任何存储，仅按 room 广播；前端在客户端维持加密密钥解密消息。

## 密钥与房间
- **房间指纹**：`SHA-256(password)` → 64 位 hex，作为 Durable Object 的命名空间
- **加密密钥**：对同一 `password` 做 `SHA-256` 并导入为 AES-GCM，用于前端加密/解密
- 只有同一密钥的客户端才能进入同一房间并解锁消息

## 数据流
1. 用户输入密钥 → 派生 roomId 与 cryptoKey
2. 建立 `wss://host/ws/:roomId` 实时连接
3. 文本/文件 AES-GCM 加密并通过 WebSocket 发送（文件会根据大小拆成 `file_chunk`）
4. Durable Object 负责广播到同房间客户端
5. 接收端按密钥解密：文本渲染为消息，文件渲染成“文件名 / 大小 + 下载”卡片

## 消息格式（简化）
```json
{
  "v": 1,
  "type": "text|file|file_chunk",
  "sender": "uuid",
  "time": 1710000000000,
  "iv": "base64",
  "data": "base64",
  "name": "document.pdf",
  "mime": "application/pdf",
  "size": 123456
}
```
- `text` 仍代表纯文本，`file` / `file_chunk` 支持任意二进制文件（图片也同样处理）
- 文件传输时会带 `name`/`mime`/`size` 以恢复原始信息，前端以 `file_chunk` 合并并立即生成下载链接
- 如果刷新页面，内存中的文件会消失，必须在收到后尽快点击 “下载”

## 限制
- 单个 WebSocket 文本帧上限约 1MB，超过部分会在前端拆成多条 `file_chunk`
- 前端限制文件大小 5MB（`MAX_FILE_BYTES`）、每片 240KB，页面提示“文件最大 5 MB”
- 文件仅在浏览器内存中保存，刷新或关闭页面会丢失未下载的内容
