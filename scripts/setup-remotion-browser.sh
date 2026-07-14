#!/bin/bash
# Setup script: Downloads chrome-headless-shell for Remotion rendering.
#
# macOS blocks system Chrome from being spawned by Node.js because it can't
# access ~/Library/Application Support/Google/Chrome/ (SingletonLock, Crashpad)
# from a non-Chrome parent process. Remotion's own chrome-headless-shell binary
# doesn't have this issue.
#
# Usage: Run this from the project root directory in Terminal.app:
#   bash scripts/setup-remotion-browser.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REMOTION_DIR="$PROJECT_ROOT/remotion-renderer"

echo "==> Downloading chrome-headless-shell for Remotion..."
echo "    Project: $REMOTION_DIR"

cd "$REMOTION_DIR"

# Use Remotion's built-in Node API to download
node -e "
const { downloadBrowser, getRevisionInfo } = require('@remotion/renderer/dist/browser/BrowserFetcher');

async function main() {
  const info = getRevisionInfo();
  
  if (info.local) {
    console.log('✅ chrome-headless-shell already downloaded at:');
    console.log('   ' + info.executablePath);
    return;
  }
  
  console.log('📦 Downloading chrome-headless-shell...');
  console.log('   URL: ' + info.url);
  
  await downloadBrowser({
    logLevel: 'info',
    indent: false,
    onProgress: (p) => {
      const pct = Math.round(p.percent * 100);
      const mb = (p.downloadedBytes / 1024 / 1024).toFixed(1);
      const total = (p.totalSizeInBytes / 1024 / 1024).toFixed(1);
      process.stdout.write('\r   Progress: ' + pct + '% (' + mb + '/' + total + ' MB)');
    },
    version: null
  });
  
  console.log('');
  const newInfo = getRevisionInfo();
  console.log('✅ Downloaded successfully!');
  console.log('   Path: ' + newInfo.executablePath);
}

main().catch(e => {
  console.error('❌ Download failed:', e.message);
  process.exit(1);
});
"

echo ""
echo "==> Done! You can now use the Remotion engine for rendering."
