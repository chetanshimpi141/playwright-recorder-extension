# Installation Guide

## Prerequisites

- Google Chrome browser (version 88 or higher)
- Basic knowledge of Chrome extensions

## Step-by-Step Installation

### 1. Download the Extension

1. Clone or download this repository to your local machine
2. Extract the files if downloaded as a ZIP

### 2. Open Chrome Extensions Page

1. Open Google Chrome
2. Type `chrome://extensions/` in the address bar
3. Press Enter

### 3. Enable Developer Mode

1. Look for the "Developer mode" toggle in the top-right corner
2. Click the toggle to enable it
3. You should see additional options appear below

### 4. Load the Extension

1. Click the "Load unpacked" button
2. Navigate to the folder containing the extension files
3. Select the folder and click "Select Folder"
4. The extension should now appear in your extensions list

### 5. Verify Installation

1. Look for the Playwright Recorder icon in your Chrome toolbar
2. If you don't see it, click the puzzle piece icon (extensions menu) in the toolbar
3. Find "Playwright Test Recorder" and click the pin icon to keep it visible

## Troubleshooting

### Extension Not Appearing

- Make sure you selected the correct folder (the one containing `manifest.json`)
- Check that all required files are present:
  - `manifest.json`
  - `background.js`
  - `content.js`
  - `popup.html`
  - `popup.js`

### Permission Errors

- The extension requires permissions to:
  - Access all websites (`<all_urls>`)
  - Download files
  - Access active tabs
- These permissions are necessary for the extension to function properly

### Extension Not Working

1. Check the Chrome extensions page for any error messages
2. Try reloading the extension by clicking the refresh icon
3. Restart Chrome if issues persist

## First Use

1. Navigate to any website you want to test
2. Click the Playwright Recorder extension icon
3. Enter a test file name
4. Select your preferred programming language
5. Click "Start Recording"
6. Perform your manual testing actions
7. Click "Stop Recording" when done
8. The generated test file will be downloaded automatically

## Uninstalling

1. Go to `chrome://extensions/`
2. Find "Playwright Test Recorder"
3. Click "Remove"
4. Confirm the removal

## Updating

To update the extension:

1. Download the latest version
2. Remove the old extension (see Uninstalling above)
3. Follow the installation steps again with the new version

## Security Note

This extension:
- Only records actions when you explicitly start recording
- Does not send any data to external servers
- Only downloads files to your local machine
- Requires explicit permissions for each website

## Support

If you encounter issues during installation:

1. Check the troubleshooting section above
2. Ensure you're using a supported Chrome version
3. Try disabling other extensions that might conflict
4. Check the browser console for error messages 