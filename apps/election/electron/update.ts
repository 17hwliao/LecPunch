import { app, net } from 'electron';
import { compareVersions, hasInstaller } from './version';

export type UpdateStatus = {
  currentVersion: string;
  latestVersion?: string;
  releaseUrl?: string;
  available: boolean;
  checked: boolean;
};

const latestReleaseApi = 'https://api.github.com/repos/lec-org/LecPunch/releases/latest';
const latestReleaseUrl = 'https://github.com/lec-org/LecPunch/releases/latest';

export const checkForUpdate = async (): Promise<UpdateStatus> => {
  const currentVersion = app.getVersion();
  try {
    const response = await net.fetch(latestReleaseApi, {
      headers: { Accept: 'application/vnd.github+json' }
    });
    if (!response.ok) throw new Error(`GitHub 返回 ${response.status}`);
    const release = await response.json() as { tag_name?: unknown; draft?: unknown; prerelease?: unknown; assets?: unknown };
    if (release.draft || release.prerelease || typeof release.tag_name !== 'string' || !/^v?\d+\.\d+\.\d+$/.test(release.tag_name) || !Array.isArray(release.assets)) {
      throw new Error('GitHub Release 数据无效');
    }
    const assetNames = release.assets.flatMap((asset) => asset && typeof asset === 'object' && 'name' in asset && typeof asset.name === 'string' ? [asset.name] : []);
    const available = compareVersions(release.tag_name, currentVersion) > 0 && hasInstaller(assetNames, process.platform, process.arch);
    return {
      currentVersion,
      latestVersion: release.tag_name.replace(/^v/, ''),
      releaseUrl: latestReleaseUrl,
      available,
      checked: true
    };
  } catch {
    return { currentVersion, available: false, checked: false };
  }
};
