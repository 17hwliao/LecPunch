export const hasInstaller = (assetNames: string[], platform: NodeJS.Platform, arch: string) => {
  if (platform === 'darwin') {
    return assetNames.some((name) => name.endsWith('.dmg') && (arch !== 'arm64' || name.includes('arm64')) && (arch !== 'x64' || !name.includes('arm64')));
  }
  if (platform === 'win32') return assetNames.some((name) => name.endsWith('.exe'));
  return false;
};

export const compareVersions = (left: string, right: string) => {
  const normalize = (value: string) => value.replace(/^v/, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const leftParts = normalize(left);
  const rightParts = normalize(right);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
};
