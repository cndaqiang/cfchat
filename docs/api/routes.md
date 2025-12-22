# Worker 路由与消息格式

## 路由

| 路由 | 说明 |
| --- | --- |
| `/` | 首页（聊天界面） |
| `/ws/:room` | WebSocket 实时通道 |
| `/health` | 健康检查 |

## WebSocket 说明
- 仅接受 `Upgrade: websocket` 请求
- `:room` 为密钥派生的 64 位 hex 指纹
- Worker 不存储消息，仅转发

## 消息结构
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
