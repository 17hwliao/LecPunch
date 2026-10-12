// Renderer and Electron main process are fully bundled/compiled into the app.
// Skip package-manager dependency-tree discovery for this pnpm workspace.
export default async function beforeBuild() {
  return false;
}
