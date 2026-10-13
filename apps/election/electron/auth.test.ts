import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import type { DesktopAuth } from './auth';

const createFixture = (directory: string, encryptionAvailable = true) => {
  const endpoint = 'https://sso.example.test';
  const resource = 'https://api.lecpunch.lec.org';
  let refreshRequests = 0;
  const safeStorage = {
    isEncryptionAvailable: () => encryptionAvailable,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString()
  };
  const shell = {
    async openExternal(value: string) {
      const authorization = new URL(value);
      assert.ok(authorization.searchParams.get('scope')?.includes('studio:admin:access'));
      const callback = new URL(authorization.searchParams.get('redirect_uri')!);
      callback.searchParams.set('code', 'fixture-code');
      callback.searchParams.set('state', authorization.searchParams.get('state')!);
      assert.equal((await fetch(callback)).status, 200);
    }
  };
  const requester = async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    if (url.pathname.endsWith('openid-configuration')) {
      return Response.json({
        authorization_endpoint: `${endpoint}/oidc/auth`,
        token_endpoint: `${endpoint}/oidc/token`,
        revocation_endpoint: `${endpoint}/oidc/token/revocation`
      });
    }
    const body = new URLSearchParams(init?.body as URLSearchParams);
    assert.equal(body.get('client_id'), 'lecpunch-election');
    if (url.pathname.endsWith('/revocation')) return new Response(null, { status: 200 });
    assert.equal(body.get('resource'), resource);
    assert.equal(body.get('organization_id'), 'lec-studio');
    if (body.get('grant_type') === 'authorization_code') {
      assert.ok(body.get('code_verifier'));
      return Response.json({ access_token: 'unscoped-token', expires_in: 3600, refresh_token: 'fixture-refresh' });
    }
    refreshRequests += 1;
    // 重现线上成员凭证契约：初始请求中的管理员权限未获批，再次请求会被拒绝。
    if (body.get('scope')?.split(' ').includes('studio:admin:access')) {
      return Response.json({ error: 'invalid_scope' }, { status: 400 });
    }
    assert.equal(body.get('refresh_token'), 'fixture-refresh');
    return Response.json({ access_token: `organization-token-${refreshRequests}`, expires_in: 3600, refresh_token: 'fixture-refresh' });
  };
  const compiled = { exports: {} as { DesktopAuth: typeof DesktopAuth } };
  // 在 Node 测试里替换 Electron 适配器；HTTP 回调和 DesktopAuth 执行实际代码。
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'auth.js'), 'utf8'), {
    module: compiled, exports: compiled.exports,
    require: (name: string) => name === 'electron' ? { safeStorage, shell } : require(name),
    process: { env: { LECPUNCH_LOGTO_ENDPOINT: endpoint, LECPUNCH_LOGTO_APP_ID: 'lecpunch-election', LECPUNCH_LOGTO_API_RESOURCE: resource, LECPUNCH_LOGTO_ORGANIZATION_ID: 'lec-studio' } },
    URL, URLSearchParams, Buffer, fetch: requester, setTimeout, clearTimeout
  });
  return { createAuth: () => new compiled.exports.DesktopAuth(directory), refreshRequests: () => refreshRequests };
};

test('成员可登录、并发续期及重启恢复，退出后清除凭证', async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lecpunch-auth-test-'));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const fixture = createFixture(directory);
  const auth = fixture.createAuth();
  context.after(() => auth.close());
  assert.equal(auth.status().authenticated, false);
  assert.equal((await auth.signIn()).authenticated, true);
  assert.equal(await auth.getAccessToken(), 'organization-token-1');
  auth.invalidateAccessToken();
  assert.deepEqual(await Promise.all(Array.from({ length: 8 }, () => auth.getAccessToken())), Array(8).fill('organization-token-2'));
  assert.equal(fixture.refreshRequests(), 2);
  const restored = fixture.createAuth();
  assert.equal(restored.status().authenticated, true);
  assert.equal(await restored.getAccessToken(), 'organization-token-3');
  await restored.signOut();
  assert.equal(restored.status().authenticated, false);
  assert.equal(fs.existsSync(path.join(directory, 'auth-refresh-token.bin')), false);
});

test('系统无法加密凭证时阻止登录', async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lecpunch-auth-test-'));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const auth = createFixture(directory, false).createAuth();
  await assert.rejects(auth.signIn(), /系统无法安全保存登录状态/);
  assert.equal(auth.status().authenticated, false);
});
