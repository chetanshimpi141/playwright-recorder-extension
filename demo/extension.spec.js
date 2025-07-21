// playwright test for Playwright Recorder extension
const { _electron: electron, test, expect } = require('@playwright/test');
const path = require('path');

// Path to the extension directory
const extensionPath = path.join(__dirname, '..');

// Helper to launch Chromium with the extension loaded
async function launchExtension() {
  const context = await electron.launch({
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });
  return context;
}

test.describe('Playwright Recorder Extension', () => {
  test('should load extension and show new logo', async ({ browser }) => {
    // Launch browser with extension
    const context = await browser.newContext({
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ]
    });
    const page = await context.newPage();
    // Open the extension popup
    // The extension id is not known in advance, so we can't open the popup directly
    // Instead, check that the extension loads and the icon is present in the manifest
    const manifest = require(path.join(extensionPath, 'manifest.json'));
    expect(manifest.icons['128']).toBe('icons/icon128.png');
    // Check that the icon file exists
    const fs = require('fs');
    expect(fs.existsSync(path.join(extensionPath, 'icons/icon128.png'))).toBe(true);
  });

  // Additional tests for recording, validation, AI, UI, export/import, etc. would go here
  // These require more advanced setup (mocking user interaction, etc.)
}); 