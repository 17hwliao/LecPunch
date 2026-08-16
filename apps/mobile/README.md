# LecPunch Mobile

## API 配置

移动端直接复用 Web 端的 REST API 契约。`EXPO_PUBLIC_API_BASE_URL` 必须包含 API 前缀：

```env
EXPO_PUBLIC_API_BASE_URL=http://your-server.example/api
```

本地 Nest 服务没有反向代理时仍使用根地址，例如 `http://192.168.x.x:4000`。

### 源项目公网 Demo

已验证的源项目 Demo API 地址为：

```env
EXPO_PUBLIC_API_BASE_URL=http://43.138.244.158/api
APP_ALLOW_CLEARTEXT_HTTP=true
```

可复制 `.env.source-demo.example` 为本机 `.env` 后启动开发服务，或构建 EAS 的 `source-demo` APK：

```bash
pnpm dlx eas-cli@latest build --platform android --profile source-demo
```

该 Demo 只用于联调：服务当前为 HTTP，登录令牌与密码在传输中不具备 HTTPS 的保密性。正式环境必须改为 HTTPS API，并不要启用 `APP_ALLOW_CLEARTEXT_HTTP`。

## 已适配接口

移动端成员流程已复用以下接口：

- `POST /auth/login`、`GET /auth/me`
- `GET /attendance/current`、`POST /attendance/check-in`、`POST /attendance/check-out`
- `GET /records/me`
- `GET /stats/me/weekly`、`GET /stats/team/current-week`

无写入的公网桥接验证：

```powershell
$env:MOBILE_BRIDGE_API_URL = 'http://43.138.244.158/api'
pnpm --filter @lecpunch/mobile test:bridge
```

桥接脚本只会登录并读取个人资料、当前打卡、统计、记录和团队榜，不会执行上卡或下卡。
