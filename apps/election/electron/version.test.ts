import assert from 'node:assert/strict';
import { compareVersions, hasInstaller } from './version';

assert.equal(compareVersions('v0.1.27', '0.1.26'), 1);
assert.equal(compareVersions('0.1.26', 'v0.1.26'), 0);
assert.equal(compareVersions('0.1.25', '0.1.26'), -1);
assert.equal(compareVersions('1.0', '1.0.0'), 0);
assert.equal(hasInstaller(['LecPunch Election-0.1.27-arm64.dmg'], 'darwin', 'arm64'), true);
assert.equal(hasInstaller(['LecPunch Election-0.1.27.dmg'], 'darwin', 'x64'), true);
assert.equal(hasInstaller(['LecPunch Election Setup 0.1.27.exe'], 'win32', 'x64'), true);
assert.equal(hasInstaller(['LecPunch Election Setup 0.1.26.exe'], 'darwin', 'arm64'), false);
