import { safeStorage, shell } from 'electron';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

export type DesktopAuthStatus = { authenticated: boolean };
type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string };
type Discovery = { authorization_endpoint: string; token_endpoint: string; revocation_endpoint?: string };

const endpoint = (process.env.LECPUNCH_LOGTO_ENDPOINT || 'http://localhost:3001').replace(/\/$/, '');
const clientId = process.env.LECPUNCH_LOGTO_APP_ID || 'lecpunch-election';
const resource = process.env.LECPUNCH_LOGTO_API_RESOURCE || 'https://api.lecpunch.lec.org';
const organizationId = process.env.LECPUNCH_LOGTO_ORGANIZATION_ID || 'lec-studio';
const scope = 'openid profile offline_access urn:logto:scope:organizations studio:access studio:admin:access';

export class DesktopAuth {
  private accessToken?: string;
  private expiresAt = 0;
  private refreshPromise?: Promise<string>;
  private pendingServer?: http.Server;
  private discoveryPromise?: Promise<Discovery>;

  constructor(private readonly userDataPath: string) {}

  status = (): DesktopAuthStatus => ({ authenticated: Boolean(this.accessToken || this.readRefreshToken()) });

  signIn = async (): Promise<DesktopAuthStatus> => {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('系统无法安全保存登录状态。');
    if (this.pendingServer) throw new Error('登录正在进行中。');
    const discovery = await this.discovery();
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(64).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const callbackPath = '/oauth/callback';
    const { server, callback } = await this.listenForCallback(callbackPath, state);
    this.pendingServer = server;
    const redirectUri = `http://127.0.0.1:${(server.address() as { port: number }).port}${callbackPath}`;
    const url = new URL(discovery.authorization_endpoint);
    Object.entries({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      resource,
      organization_id: organizationId,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'login consent',
      state
    }).forEach(([key, value]) => url.searchParams.set(key, value));
    await shell.openExternal(url.toString());
    try {
      const code = await callback;
      const tokens = await this.token(discovery.token_endpoint, {
        grant_type: 'authorization_code',
        client_id: clientId,
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
        resource,
        organization_id: organizationId
      });
      const organizationTokens = tokens.refresh_token
        ? await this.token(discovery.token_endpoint, {
            grant_type: 'refresh_token',
            client_id: clientId,
            refresh_token: tokens.refresh_token,
            // 沿用刷新凭证已获批的权限；初始请求的管理员 scope 可能未获授权。
            resource,
            organization_id: organizationId
          })
        : tokens;
      this.acceptTokens(organizationTokens);
      return { authenticated: true };
    } finally {
      server.close();
      this.pendingServer = undefined;
    }
  };

  signOut = async () => {
    this.pendingServer?.close();
    this.pendingServer = undefined;
    const refreshToken = this.readRefreshToken();
    this.clearLocal();
    if (!refreshToken) return;
    try {
      const discovery = await this.discovery();
      if (discovery.revocation_endpoint) {
        await fetch(discovery.revocation_endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: refreshToken, client_id: clientId })
        });
      }
    } catch {
      // 本地退出不能被远程撤销失败阻塞。
    }
  };

  getAccessToken = async () => {
    if (this.accessToken && Date.now() < this.expiresAt - 30_000) return this.accessToken;
    if (!this.refreshPromise) this.refreshPromise = this.refresh().finally(() => { this.refreshPromise = undefined; });
    return this.refreshPromise;
  };

  invalidateAccessToken = () => {
    this.accessToken = undefined;
    this.expiresAt = 0;
  };

  close = () => this.pendingServer?.close();

  private async refresh() {
    const refreshToken = this.readRefreshToken();
    if (!refreshToken) throw new Error('请先登录 LEC SSO。');
    try {
      const tokens = await this.token((await this.discovery()).token_endpoint, {
        grant_type: 'refresh_token', client_id: clientId, refresh_token: refreshToken,
        resource, organization_id: organizationId
      });
      this.acceptTokens(tokens);
      return tokens.access_token;
    } catch (error) {
      this.clearLocal();
      throw error;
    }
  }

  private acceptTokens(tokens: TokenResponse) {
    if (tokens.refresh_token) this.writeRefreshToken(tokens.refresh_token);
    this.accessToken = tokens.access_token;
    this.expiresAt = Date.now() + tokens.expires_in * 1000;
  }

  private async token(url: string, body: Record<string, string>) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body)
    });
    if (!response.ok) throw new Error('LEC SSO 登录状态无效，请重新登录。');
    return response.json() as Promise<TokenResponse>;
  }

  private discovery() {
    this.discoveryPromise ??= fetch(`${endpoint}/oidc/.well-known/openid-configuration`)
      .then((response) => {
        if (!response.ok) throw new Error('无法连接 LEC SSO。');
        return response.json() as Promise<Discovery>;
      });
    return this.discoveryPromise;
  }

  private listenForCallback(callbackPath: string, state: string) {
    let settle: (value: string) => void;
    let reject: (error: Error) => void;
    const callback = new Promise<string>((resolve, rejectCallback) => { settle = resolve; reject = rejectCallback; });
    const server = http.createServer((request, response) => {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (request.method !== 'GET' || url.pathname !== callbackPath) {
        response.writeHead(404).end();
        return;
      }
      if ((request.url?.length ?? 0) > 8192) {
        response.writeHead(414).end();
        return;
      }
      const code = url.searchParams.get('code');
      if (!code || url.searchParams.get('state') !== state || url.searchParams.has('error')) {
        response.writeHead(400, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Security-Policy': "default-src 'none'"
        }).end('LEC SSO 登录失败，可以关闭此页面。');
        reject(new Error('LEC SSO 登录回调无效。'));
        return;
      }
      response.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'"
      }).end('LEC SSO 登录成功，可以关闭此页面并返回 LecPunch。');
      settle(code);
    });
    server.listen(0, '127.0.0.1');
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('LEC SSO 登录超时。'));
    }, 5 * 60_000);
    callback.finally(() => clearTimeout(timer)).catch(() => undefined);
    return new Promise<{ server: http.Server; callback: Promise<string> }>((resolve, rejectListen) => {
      server.once('listening', () => resolve({ server, callback }));
      server.once('error', rejectListen);
    });
  }

  private refreshTokenPath() { return path.join(this.userDataPath, 'auth-refresh-token.bin'); }

  private readRefreshToken() {
    try {
      if (!safeStorage.isEncryptionAvailable()) return;
      return safeStorage.decryptString(fs.readFileSync(this.refreshTokenPath()));
    } catch {
      return;
    }
  }

  private writeRefreshToken(token: string) {
    const file = this.refreshTokenPath();
    const temporary = `${file}.tmp`;
    fs.writeFileSync(temporary, safeStorage.encryptString(token), { mode: 0o600 });
    fs.renameSync(temporary, file);
  }

  private clearLocal() {
    this.accessToken = undefined;
    this.expiresAt = 0;
    fs.rmSync(this.refreshTokenPath(), { force: true });
  }
}
