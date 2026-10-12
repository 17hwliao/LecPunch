import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('lecpunchDesktop', {
  platform: process.platform,
  isDesktop: true,
  isPackaged: !process.defaultApp,
  updates: {
    check: () => ipcRenderer.invoke('updates:check') as Promise<{ currentVersion: string; latestVersion?: string; releaseUrl?: string; available: boolean; checked: boolean }>,
    openRelease: () => ipcRenderer.invoke('updates:open-release') as Promise<void>
  },
  auth: {
    getStatus: () => ipcRenderer.invoke('auth:status') as Promise<{ authenticated: boolean }>,
    signIn: () => ipcRenderer.invoke('auth:sign-in') as Promise<{ authenticated: boolean }>,
    signOut: () => ipcRenderer.invoke('auth:sign-out') as Promise<void>,
    getAccessToken: () => ipcRenderer.invoke('auth:get-access-token') as Promise<string>,
    invalidateAccessToken: () => ipcRenderer.invoke('auth:invalidate-access-token') as Promise<void>,
    onChanged: (callback: (status: { authenticated: boolean }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: { authenticated: boolean }) => callback(status);
      ipcRenderer.on('auth:changed', listener);
      return () => ipcRenderer.removeListener('auth:changed', listener);
    }
  },
  notify: (payload: { title: string; body: string }) => ipcRenderer.invoke('desktop:notify', payload),
  hideToTray: () => ipcRenderer.invoke('desktop:hide-to-tray'),
  setImmersive: (enabled: boolean) => ipcRenderer.invoke('desktop:set-immersive', enabled) as Promise<{ enabled: boolean; managedApps: string[]; message: string }>,
  setWindowTheme: (theme: 'light' | 'dark') => ipcRenderer.invoke('desktop:set-window-theme', theme) as Promise<void>,
  onMainImmersive: (callback: (enabled: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, enabled: boolean) => callback(enabled);
    ipcRenderer.on('desktop:main-immersive', listener);
    return () => ipcRenderer.removeListener('desktop:main-immersive', listener);
  },
  getMeetingSettings: () => ipcRenderer.invoke('desktop:get-meeting-settings') as Promise<{ meetingOrigin: string }>,
  updateMeetingSettings: (settings: { meetingOrigin: string }) => ipcRenderer.invoke('desktop:update-meeting-settings', settings) as Promise<{ meetingOrigin: string }>,
  getAppearanceSettings: () => ipcRenderer.invoke('desktop:get-appearance-settings') as Promise<{ backgroundOpacity: number; backgroundBlur: number; backgroundUrl: string }>,
  selectAppearanceBackground: () => ipcRenderer.invoke('desktop:select-appearance-background') as Promise<{ backgroundOpacity: number; backgroundBlur: number; backgroundUrl: string }>,
  clearAppearanceBackground: () => ipcRenderer.invoke('desktop:clear-appearance-background') as Promise<{ backgroundOpacity: number; backgroundBlur: number; backgroundUrl: string }>,
  updateAppearanceSettings: (settings: { backgroundOpacity?: number; backgroundBlur?: number }) => ipcRenderer.invoke('desktop:update-appearance-settings', settings) as Promise<{ backgroundOpacity: number; backgroundBlur: number; backgroundUrl: string }>,
  openExternal: (url: string) => ipcRenderer.invoke('desktop:open-external', url) as Promise<void>,
  saveMarkdown: (payload: { filename: string; content: string }) => ipcRenderer.invoke('desktop:save-markdown', payload) as Promise<{ saved: boolean; filePath?: string }>
});
