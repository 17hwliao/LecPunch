import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, Menu, nativeImage, net, Notification, protocol, session, shell, Tray } from 'electron';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DesktopAuth } from './auth';
import { checkForUpdate, type UpdateStatus } from './update';

protocol.registerSchemesAsPrivileged([
  { scheme: 'lecpunch-assets', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let desktopAuth: DesktopAuth;
let lastUpdateStatus: UpdateStatus | null = null;
let isQuitting = false;
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();
// Development-only evidence for window visibility investigations. The logger
// is inert unless the local launcher provides an explicit writable file path.
const diagnosticArgument = process.argv.find((argument) => argument.startsWith('--lecpunch-window-diagnostic-path='));
const windowDiagnosticPath = process.env.LECPUNCH_WINDOW_DIAGNOSTIC_PATH
  ?? diagnosticArgument?.slice('--lecpunch-window-diagnostic-path='.length);
const writeWindowDiagnostic = (event: string, name: string, window?: BrowserWindow | null, details?: unknown) => {
  if (!windowDiagnosticPath) return;
  try {
    fs.appendFileSync(windowDiagnosticPath, `${JSON.stringify({
      at: new Date().toISOString(),
      event,
      name,
      visible: window?.isDestroyed() ? false : window?.isVisible(),
      bounds: window?.isDestroyed() ? undefined : window?.getBounds(),
      details
    })}\n`, 'utf8');
  } catch {
    // Diagnostics must never prevent the desktop client from opening.
  }
};
const observeWindowDiagnostics = (name: string, window: BrowserWindow) => {
  writeWindowDiagnostic('created', name, window);
  window.on('ready-to-show', () => writeWindowDiagnostic('ready-to-show', name, window));
  window.on('show', () => writeWindowDiagnostic('show', name, window));
  window.on('hide', () => writeWindowDiagnostic('hide', name, window));
  window.on('unresponsive', () => writeWindowDiagnostic('unresponsive', name, window));
  window.on('closed', () => writeWindowDiagnostic('closed', name, window));
  window.webContents.on('did-finish-load', () => writeWindowDiagnostic('did-finish-load', name, window));
  window.webContents.on('did-fail-load', (_event, code, description, url) => writeWindowDiagnostic('did-fail-load', name, window, { code, description, url }));
  window.webContents.on('render-process-gone', (_event, details) => writeWindowDiagnostic('render-process-gone', name, window, details));
  window.webContents.on('console-message', (event) => writeWindowDiagnostic('web-console', name, window, {
    level: event.level,
    message: event.message,
    line: event.lineNumber,
    sourceId: event.sourceId
  }));
};
type MeetingSettings = { meetingOrigin: string };
type AppearanceSettings = { backgroundFile: string; backgroundOpacity: number; backgroundBlur: number };
type QuietNotificationResult = { enabled: boolean; managedApps: string[]; message: string };
let meetingSettings: MeetingSettings = { meetingOrigin: '' };
let appearanceSettings: AppearanceSettings = { backgroundFile: '', backgroundOpacity: 62, backgroundBlur: 0 };
let quietNotificationConsentGranted = false;
const quietNotificationBackup = new Map<string, string | null>();
let quietPopupGuard: ChildProcess | null = null;
const meetingSettingsPath = () => path.join(app.getPath('userData'), 'meeting-settings.json');
const isPrivateMeetingHost = (hostname: string) => {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local')) return true;
  const parts = host.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
};
const normalizeMeetingOrigin = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return '';
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('会议地址格式无效。');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('会议地址必须是无路径、无账号信息的 HTTPS 局域网地址。');
  }
  if (!isPrivateMeetingHost(url.hostname)) throw new Error('仅允许配置局域网 IP、localhost 或 .local 会议主机。');
  return url.origin;
};
const loadMeetingSettings = () => {
  try {
    const saved = JSON.parse(fs.readFileSync(meetingSettingsPath(), 'utf8')) as Partial<MeetingSettings>;
    meetingSettings = { meetingOrigin: normalizeMeetingOrigin(saved.meetingOrigin) };
  } catch {
    meetingSettings = { meetingOrigin: '' };
  }
};
const saveMeetingSettings = () => fs.writeFileSync(meetingSettingsPath(), JSON.stringify(meetingSettings));
const appearanceSettingsPath = () => path.join(app.getPath('userData'), 'appearance-settings.json');
const appearanceBackgroundRoot = () => path.join(app.getPath('userData'), 'main-background');
const normalizeAppearanceSettings = (settings: Partial<AppearanceSettings>): AppearanceSettings => ({
  backgroundFile: typeof settings.backgroundFile === 'string' && /^[a-z0-9-]+\.(?:png|jpe?g|webp)$/i.test(settings.backgroundFile)
    ? settings.backgroundFile : '',
  backgroundOpacity: Number.isFinite(Number(settings.backgroundOpacity))
    ? Math.round(Math.max(0, Math.min(100, Number(settings.backgroundOpacity)))) : 62,
  backgroundBlur: Number.isFinite(Number(settings.backgroundBlur))
    ? Math.round(Math.max(0, Math.min(24, Number(settings.backgroundBlur)))) : 0
});
const loadAppearanceSettings = () => {
  try {
    appearanceSettings = normalizeAppearanceSettings(JSON.parse(fs.readFileSync(appearanceSettingsPath(), 'utf8')) as Partial<AppearanceSettings>);
  } catch {
    appearanceSettings = { backgroundFile: '', backgroundOpacity: 62, backgroundBlur: 0 };
  }
  if (appearanceSettings.backgroundFile && !fs.existsSync(path.join(appearanceBackgroundRoot(), appearanceSettings.backgroundFile))) {
    appearanceSettings.backgroundFile = '';
  }
};
const saveAppearanceSettings = () => fs.writeFileSync(appearanceSettingsPath(), JSON.stringify(appearanceSettings));
const getAppearanceSettingsForRenderer = () => {
  const file = appearanceSettings.backgroundFile;
  const filePath = file ? path.join(appearanceBackgroundRoot(), file) : '';
  const version = filePath && fs.existsSync(filePath) ? fs.statSync(filePath).mtimeMs : 0;
  return {
    backgroundOpacity: appearanceSettings.backgroundOpacity,
    backgroundBlur: appearanceSettings.backgroundBlur,
    backgroundUrl: file && version ? `lecpunch-assets://appearance/${encodeURIComponent(file)}?v=${version}` : ''
  };
};
const selectAppearanceBackground = async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: '选择工作台背景图片',
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  });
  if (result.canceled || !result.filePaths[0]) return getAppearanceSettingsForRenderer();
  const source = result.filePaths[0];
  const extension = path.extname(source).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) throw new Error('仅支持 PNG、JPG、JPEG 或 WebP 背景图片。');
  if (fs.statSync(source).size > 15 * 1024 * 1024) throw new Error('背景图片请控制在 15MB 以内。');
  fs.mkdirSync(appearanceBackgroundRoot(), { recursive: true });
  const filename = `main-background${extension === '.jpeg' ? '.jpg' : extension}`;
  fs.copyFileSync(source, path.join(appearanceBackgroundRoot(), filename));
  appearanceSettings.backgroundFile = filename;
  saveAppearanceSettings();
  return getAppearanceSettingsForRenderer();
};
const clearAppearanceBackground = () => {
  const file = appearanceSettings.backgroundFile;
  if (file) fs.rmSync(path.join(appearanceBackgroundRoot(), file), { force: true });
  appearanceSettings.backgroundFile = '';
  saveAppearanceSettings();
  return getAppearanceSettingsForRenderer();
};
const isConfiguredMeetingUrl = (value: string) => {
  if (!meetingSettings.meetingOrigin) return false;
  try {
    return new URL(value).origin === meetingSettings.meetingOrigin;
  } catch {
    return false;
  }
};

// The captain's LAN Jitsi uses a local certificate. Do not disable certificate
// verification globally: only the exact origin stored in meeting-settings.json
// may use this narrow fallback when the operating system does not trust its CA.
app.on('certificate-error', (event, _webContents, url, _error, _certificate, callback) => {
  if (!isConfiguredMeetingUrl(url)) return callback(false);
  event.preventDefault();
  callback(true);
});
const quietNotificationSettingsPath = () => path.join(app.getPath('userData'), 'quiet-notification-settings.json');
const loadQuietNotificationSettings = () => {
  try {
    const saved = JSON.parse(fs.readFileSync(quietNotificationSettingsPath(), 'utf8')) as { consentGranted?: boolean; backup?: Record<string, string | null> };
    quietNotificationConsentGranted = saved.consentGranted === true;
    Object.entries(saved.backup ?? {}).forEach(([key, value]) => quietNotificationBackup.set(key, value));
  } catch {
    // First launch has no notification changes to restore.
  }
};
const saveQuietNotificationSettings = () => fs.writeFileSync(quietNotificationSettingsPath(), JSON.stringify({
  consentGranted: quietNotificationConsentGranted,
  backup: Object.fromEntries(quietNotificationBackup)
}));
const runReg = (args: string[]) => new Promise<{ stdout: string }>((resolve, reject) => {
  execFile('reg.exe', args, { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
    if (error) reject(error);
    else resolve({ stdout });
  });
});
const notificationSettingsRoot = 'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings';
const quietPopupGuardPath = () => path.join(app.getPath('userData'), 'quiet-popup-guard.ps1');
const quietPopupGuardScript = `
$source = @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
public static class LecPunchQuietWindowGuard {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr data);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int command);
}
'@
Add-Type -TypeDefinition $source
while ($true) {
  [LecPunchQuietWindowGuard]::EnumWindows({
    param($handle, $unused)
    if (-not [LecPunchQuietWindowGuard]::IsWindowVisible($handle)) { return $true }
    $processId = [uint32]0
    [LecPunchQuietWindowGuard]::GetWindowThreadProcessId($handle, [ref]$processId) | Out-Null
    try { $process = Get-Process -Id $processId -ErrorAction Stop } catch { return $true }
    if ($process.ProcessName -notmatch '^(QQ|WeChat|Weixin)$') { return $true }
    $rect = [LecPunchQuietWindowGuard+RECT]::new()
    [LecPunchQuietWindowGuard]::GetWindowRect($handle, [ref]$rect) | Out-Null
    $width = $rect.Right - $rect.Left
    $height = $rect.Bottom - $rect.Top
    # Preserve full chat windows. QQ/WeChat native notification panes are
    # short, secondary top-level windows; hide only that constrained shape.
    if ($width -ge 160 -and $width -le 700 -and $height -ge 55 -and $height -le 420) {
      [LecPunchQuietWindowGuard]::ShowWindow($handle, 0) | Out-Null
    }
    return $true
  }, [IntPtr]::Zero) | Out-Null
  Start-Sleep -Milliseconds 150
}
`;
const setQuietNativePopupGuard = (enabled: boolean) => {
  if (process.platform !== 'win32') return false;
  if (!enabled) {
    quietPopupGuard?.kill();
    quietPopupGuard = null;
    return false;
  }
  if (quietPopupGuard && !quietPopupGuard.killed) return true;
  try {
    fs.writeFileSync(quietPopupGuardPath(), quietPopupGuardScript, 'utf8');
    quietPopupGuard = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', quietPopupGuardPath()], { windowsHide: true, stdio: 'ignore' });
    quietPopupGuard.once('exit', () => { quietPopupGuard = null; });
    return true;
  } catch {
    quietPopupGuard = null;
    return false;
  }
};
const quietAppKind = (key: string): '微信' | 'QQ' | null => {
  const appId = key.split('\\').pop()?.toLowerCase() ?? '';
  // Keep this deliberately strict: QQLive and other Tencent products must not
  // be muted when the user only asks to silence QQ / WeChat messages.
  if (/(^|[!._-])(wechat|weixin|wecom|tencentwechat|tencentwework)([!._-]|$)/i.test(appId)) return '微信';
  if (/(^|!)(qq|tencentqq|qq\.exe|com\.tencent\.qq)(?=$|[._-])/i.test(appId)) return 'QQ';
  return null;
};
const findQuietAppNotificationKeys = async () => {
  const { stdout } = await runReg(['query', notificationSettingsRoot, '/s']);
  return [...new Set(stdout.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith('HKEY_CURRENT_USER\\') && quietAppKind(line)))];
};
const readEnabledValue = async (key: string) => {
  try {
    const { stdout } = await runReg(['query', key, '/v', 'Enabled']);
    const match = stdout.match(/Enabled\s+REG_DWORD\s+(0x[\da-f]+)/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};
const setQuietAppNotifications = async (enabled: boolean): Promise<QuietNotificationResult> => {
  if (process.platform !== 'win32') return { enabled: false, managedApps: [], message: '该功能仅支持 Windows。' };
  if (enabled && !quietNotificationConsentGranted) {
    const promptOptions = {
      type: 'question' as const,
      buttons: ['取消', '授权并开启'] as string[],
      defaultId: 1,
      cancelId: 0,
      title: '授权管理 QQ / 微信通知',
      message: '允许 LecPunch 管理 Windows 已登记的 QQ、微信通知吗？',
      detail: '开启后会暂时关闭这些应用的 Windows 通知横幅与提示音；退出免提示模式时会恢复你此前的设置。不会读取聊天内容、账号或文件。'
    };
    const result = mainWindow ? await dialog.showMessageBox(mainWindow, promptOptions) : await dialog.showMessageBox(promptOptions);
    if (result.response !== 1) return { enabled: false, managedApps: [], message: '未授予 QQ、微信通知管理权限。' };
    quietNotificationConsentGranted = true;
    saveQuietNotificationSettings();
  }
  let keys: string[] = [];
  let popupGuardActive = false;
  try {
    keys = await findQuietAppNotificationKeys();
    for (const key of keys) {
      if (enabled) {
        if (!quietNotificationBackup.has(key)) quietNotificationBackup.set(key, await readEnabledValue(key));
        await runReg(['add', key, '/v', 'Enabled', '/t', 'REG_DWORD', '/d', '0', '/f']);
      } else if (quietNotificationBackup.has(key)) {
        const previous = quietNotificationBackup.get(key);
        if (previous) await runReg(['add', key, '/v', 'Enabled', '/t', 'REG_DWORD', '/d', String(Number.parseInt(previous, 16)), '/f']);
        else await runReg(['delete', key, '/v', 'Enabled', '/f']);
      }
    }
    if (!enabled) quietNotificationBackup.clear();
    saveQuietNotificationSettings();
  } catch {
    popupGuardActive = setQuietNativePopupGuard(enabled);
    return { enabled: false, managedApps: [], message: popupGuardActive ? 'Windows 横幅设置暂时无法修改，但 QQ/微信原生通知窗拦截已开启。' : 'Windows 通知设置暂时无法修改；可改用 Windows 专注助手。' };
  }
  popupGuardActive = setQuietNativePopupGuard(enabled);
  const managedApps = keys.map((key) => quietAppKind(key)).filter((name): name is '微信' | 'QQ' => Boolean(name));
  if (!managedApps.length) return { enabled, managedApps: [], message: enabled && popupGuardActive ? '未发现已登记的 Windows 横幅；QQ/微信原生通知窗拦截已开启。' : '未发现已登记的 QQ 或微信 Windows 通知。请先让对应软件产生一次系统通知后，再重新开启免提示模式。' };
  return { enabled, managedApps: [...new Set(managedApps)], message: enabled ? `已关闭 ${[...new Set(managedApps)].join('、')} 的 Windows 通知${popupGuardActive ? '，并开启原生通知窗拦截。' : '。'}` : `已恢复 ${[...new Set(managedApps)].join('、')} 的原通知设置，并停止原生通知窗拦截。` };
};
const getIconPath = () => {
  const icon = process.platform === 'darwin' ? 'icon.icns' : 'icon.ico';
  return app.isPackaged ? path.join(process.resourcesPath, icon) : path.join(__dirname, '..', 'resources', icon);
};
const setMainWindowTheme = (theme: 'light' | 'dark') => {
  if (!mainWindow || process.platform !== 'win32') return;
  mainWindow.setTitleBarOverlay(theme === 'dark'
    ? { color: '#00000000', symbolColor: '#d7edf9', height: 36 }
    : { color: '#00000000', symbolColor: '#36434d', height: 36 });
};

const showWindow = () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
};

const createTray = () => {
  const icon = nativeImage.createFromPath(getIconPath());
  tray = new Tray(icon);
  tray.setToolTip('LecPunch Election');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示 LecPunch Election', click: showWindow },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]));
  tray.on('click', showWindow);
};

const loadRenderer = (window: BrowserWindow) => app.isPackaged
  ? window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  : window.loadURL('http://127.0.0.1:5174/');

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 760,
    // Keep Windows controls while removing the native menu bar and white title bar.
    titleBarStyle: process.platform === 'win32' ? 'hidden' : 'hiddenInset',
    ...(process.platform === 'win32'
      ? {
          titleBarOverlay: {
            // The app paints the backdrop underneath. Do not introduce a second
            // opaque title-bar strip between the background and native controls.
            color: '#00000000',
            symbolColor: '#22557f',
            height: 36
          }
        }
      : {}),
    backgroundColor: '#edf8ff',
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  observeWindowDiagnostics('main', mainWindow);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (new URL(url).protocol === 'https:') void shell.openExternal(url);
    } catch {
      // 拒绝非法外部地址。
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) event.preventDefault();
  });

  void loadRenderer(mainWindow);
  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

if (hasSingleInstanceLock) app.whenReady().then(() => {
  protocol.handle('lecpunch-assets', (request) => {
    const requestUrl = new URL(request.url);
    const relativePath = path.normalize(decodeURIComponent(requestUrl.pathname)).replace(/^([/\\])+/, '');
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return new Response('Not found', { status: 404 });
    }
    const root = requestUrl.hostname === 'appearance' ? appearanceBackgroundRoot() : null;
    if (!root) return new Response('Not found', { status: 404 });
    const assetPath = path.join(root, relativePath);
    if (!assetPath.startsWith(`${root}${path.sep}`) && assetPath !== root) return new Response('Not found', { status: 404 });
    // The internal protocol serves only the user-selected local background.
    return net.fetch(pathToFileURL(assetPath).toString()).then((response) => {
      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    });
  });

  Menu.setApplicationMenu(null);
  desktopAuth = new DesktopAuth(app.getPath('userData'));
  loadMeetingSettings();
  loadAppearanceSettings();
  loadQuietNotificationSettings();
  // Jitsi is the only remote page embedded by the desktop client. Keep both
  // permission paths fail-closed and tied to the exact locally configured
  // HTTPS origin; no other website can request camera or microphone access.
  session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) =>
    permission === 'media' && isConfiguredMeetingUrl(requestingOrigin)
  );
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    callback(permission === 'media' && isConfiguredMeetingUrl(details.requestingUrl));
  });
  // Screen sharing inside the Jitsi iframe: the OS-native picker (screens +
  // windows, the same experience as browser sharing) is preferred. When the
  // platform picker is unavailable, fall back to sharing the primary screen.
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      callback(sources.length ? { video: sources[0] } : {});
    }).catch(() => callback({}));
  }, { useSystemPicker: true });
  createWindow();
  createTray();

  const fromMainWindow = (event: Electron.IpcMainInvokeEvent) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('无权访问桌面登录状态。');
  };
  const notifyAuthChanged = () => mainWindow?.webContents.send('auth:changed', desktopAuth.status());
  ipcMain.handle('auth:status', (event) => { fromMainWindow(event); return desktopAuth.status(); });
  ipcMain.handle('auth:sign-in', async (event) => {
    fromMainWindow(event);
    const status = await desktopAuth.signIn();
    notifyAuthChanged();
    return status;
  });
  ipcMain.handle('auth:sign-out', async (event) => {
    fromMainWindow(event);
    await desktopAuth.signOut();
    notifyAuthChanged();
  });
  ipcMain.handle('auth:get-access-token', (event) => { fromMainWindow(event); return desktopAuth.getAccessToken(); });
  ipcMain.handle('auth:invalidate-access-token', (event) => { fromMainWindow(event); desktopAuth.invalidateAccessToken(); });
  ipcMain.handle('updates:check', async (event) => {
    fromMainWindow(event);
    lastUpdateStatus = await checkForUpdate();
    return lastUpdateStatus;
  });
  ipcMain.handle('updates:open-release', async (event) => {
    fromMainWindow(event);
    if (!lastUpdateStatus?.available || !lastUpdateStatus.releaseUrl) return;
    await shell.openExternal(lastUpdateStatus.releaseUrl);
  });

  ipcMain.handle('desktop:notify', (_event, payload: { title?: string; body?: string }) => {
    if (!Notification.isSupported()) return { supported: false };
    new Notification({
      title: payload.title || 'LecPunch Election',
      body: payload.body || '',
      // Let Windows use the user's configured notification sound. Quiet mode
      // only suppresses QQ/WeChat; LecPunch reminders must remain audible.
      silent: false
    }).show();
    return { supported: true };
  });

  ipcMain.handle('desktop:hide-to-tray', () => mainWindow?.hide());
  ipcMain.handle('desktop:set-immersive', async (_event, enabled: boolean) => {
    const quietResult = await setQuietAppNotifications(Boolean(enabled));
    mainWindow?.webContents.send('desktop:main-immersive', Boolean(enabled) && quietResult.enabled);
    return quietResult;
  });
  ipcMain.handle('desktop:set-window-theme', (_event, value: unknown) => {
    if (value !== 'light' && value !== 'dark') throw new Error('窗口主题无效。');
    setMainWindowTheme(value);
  });
  ipcMain.handle('desktop:get-meeting-settings', () => meetingSettings);
  ipcMain.handle('desktop:update-meeting-settings', (_event, changes: Partial<MeetingSettings>) => {
    meetingSettings = { meetingOrigin: normalizeMeetingOrigin(changes?.meetingOrigin) };
    saveMeetingSettings();
    return meetingSettings;
  });
  ipcMain.handle('desktop:get-appearance-settings', () => getAppearanceSettingsForRenderer());
  ipcMain.handle('desktop:select-appearance-background', () => selectAppearanceBackground());
  ipcMain.handle('desktop:clear-appearance-background', () => clearAppearanceBackground());
  ipcMain.handle('desktop:update-appearance-settings', (_event, changes: Partial<AppearanceSettings>) => {
    appearanceSettings = { ...appearanceSettings, ...normalizeAppearanceSettings({ ...appearanceSettings, ...changes }) };
    saveAppearanceSettings();
    return getAppearanceSettingsForRenderer();
  });
  ipcMain.handle('desktop:open-external', async (_event, value: unknown) => {
    if (typeof value !== 'string') throw new Error('外部地址无效。');
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error('外部地址无效。');
    }
    if (url.protocol !== 'https:') throw new Error('仅允许打开 HTTPS 外部地址。');
    await shell.openExternal(url.toString());
  });
  ipcMain.handle('desktop:save-markdown', async (_event, payload: { filename?: unknown; content?: unknown }) => {
    if (typeof payload?.content !== 'string') throw new Error('Markdown 内容无效。');
    const requested = typeof payload.filename === 'string' ? payload.filename : 'weekly-report.md';
    const filename = requested.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 100) || 'weekly-report.md';
    const options = {
      title: '保存本周周报 Markdown',
      defaultPath: filename.endsWith('.md') ? filename : `${filename}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    };
    const result = mainWindow ? await dialog.showSaveDialog(mainWindow, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return { saved: false };
    await fs.promises.writeFile(result.filePath, payload.content, 'utf8');
    return { saved: true, filePath: result.filePath };
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      showWindow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  desktopAuth?.close();
  setQuietNativePopupGuard(false);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
