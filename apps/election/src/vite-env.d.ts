/// <reference types="vite/client" />

interface Window {
  lecpunchDesktop?: {
    platform: string;
    isDesktop: boolean;
    isPackaged: boolean;
    updates: {
      check: () => Promise<{ currentVersion: string; latestVersion?: string; releaseUrl?: string; available: boolean; checked: boolean }>;
      openRelease: () => Promise<void>;
    };
    auth: {
      getStatus: () => Promise<{ authenticated: boolean }>;
      signIn: () => Promise<{ authenticated: boolean }>;
      signOut: () => Promise<void>;
      getAccessToken: () => Promise<string>;
      invalidateAccessToken: () => Promise<void>;
      onChanged: (callback: (status: { authenticated: boolean }) => void) => () => void;
    };
    notify: (payload: { title: string; body: string }) => Promise<void>;
    hideToTray: () => Promise<void>;
    setImmersive: (enabled: boolean) => Promise<{ enabled: boolean; managedApps: string[]; message: string }>;
    setWindowTheme: (theme: 'light' | 'dark') => Promise<void>;
    onMainImmersive: (callback: (enabled: boolean) => void) => () => void;
    getMeetingSettings: () => Promise<{ meetingOrigin: string }>;
    updateMeetingSettings: (settings: { meetingOrigin: string }) => Promise<{ meetingOrigin: string }>;
    getAppearanceSettings: () => Promise<{ backgroundOpacity: number; backgroundBlur: number; backgroundUrl: string }>;
    selectAppearanceBackground: () => Promise<{ backgroundOpacity: number; backgroundBlur: number; backgroundUrl: string }>;
    clearAppearanceBackground: () => Promise<{ backgroundOpacity: number; backgroundBlur: number; backgroundUrl: string }>;
    updateAppearanceSettings: (settings: { backgroundOpacity?: number; backgroundBlur?: number }) => Promise<{ backgroundOpacity: number; backgroundBlur: number; backgroundUrl: string }>;
    openExternal: (url: string) => Promise<void>;
    saveMarkdown: (payload: { filename: string; content: string }) => Promise<{ saved: boolean; filePath?: string }>;
  };
}
