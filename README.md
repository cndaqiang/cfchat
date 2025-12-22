# Cloudflare Workers 密钥消息

基于 Cloudflare Workers 的实时加密消息页面：消息仅在浏览器本地保存，Worker 只做 WebSocket 转发。

## ✅ 特性

- ✅ 实时消息（WebSocket 转发）
- ✅ 密钥加密/解密（AES-GCM）
- ✅ 消息不落地，只保存在浏览器本地
- ✅ 图片粘贴/上传发送（一次性转发）
- ✅ 无 KV/数据库存储，Durable Object 仅用于实时转发

## 🚀 快速开始

```bash
# 本地开发
wrangler dev

# 部署
wrangler deploy
```

## 📌 使用方式

1. 打开首页，输入共享密钥（自动保存到浏览器）
2. 发送文本或粘贴/上传图片
3. 其他人输入相同密钥即可实时解密消息

## ⚠️ 注意事项

- 密钥改变会进入新的房间指纹
- 浏览器本地记录可随时清空
- 图片默认限制 512KB（可在代码中修改）

## 📚 文档

- 文档索引：`docs/INDEX.md`
- 使用手册：`docs/usage/usage.md`
- 需求说明：`docs/requirements/requirements.md`
- 技术方案：`docs/technical/architecture.md`
- 路由说明：`docs/api/routes.md`
- 开发日志：`docs/logs/development.md`

---

*Made with Cloudflare Workers*
