// Background script for Playwright Recorder Extension
let isRecording = false;
let recordedActions = [];
let actionCount = 0;
let currentFileName = '';
let currentLanguage = 'javascript';
let recordingStartTime = null;
let currentTabId = null;
let heartbeatInterval = null;
let recordingPersistenceInterval = null;
let downloadRetryCount = 0;
let maxDownloadRetries = 3;

function updateStorage() {
  // TODO: implement storage update if needed
}

function loadRecordingState() {
  // TODO: implement loading of recording state from storage if needed
}

// Load recording state from storage on startup
chrome.runtime.onStartup.addListener(() => {
  loadRecordingState();
});

chrome.runtime.onInstalled.addListener(() => {
  loadRecordingState();
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action, request);
  
  try {
    switch (request.action) {
      case 'startRecording':
        startRecording(request.fileName, request.language);
        sendResponse({ 
          success: true, 
          actionCount: actionCount,
          fileName: currentFileName
        });
        break;
        
      case 'stopRecording':
        stopRecording();
        sendResponse({ 
          success: true, 
          actionCount: actionCount,
          fileName: currentFileName,
          actions: recordedActions
        });
        break;
        
      case 'generateScript':
        generateScriptFromActions(request.actions, request.fileName, request.language);
        sendResponse({ 
          success: true, 
          fileName: `${request.fileName}.spec.js`
        });
        break;
        
      case 'recordAction':
        if (isRecording) {
          recordedActions.push(request.actionData);
          actionCount++;
          updateStorage();
          console.log('Action recorded:', request.actionData.type, 'Total:', actionCount);
          
          // Notify popup if it's open
          try {
            chrome.runtime.sendMessage({
              action: 'updateStats',
              actionCount: actionCount
            });
          } catch (error) {
            console.warn('Failed to notify popup:', error);
          }
        }
        sendResponse({ success: true });
        break;
        
      case 'getRecordingStatus':
        sendResponse({ 
          isRecording: isRecording,
          actionCount: actionCount,
          fileName: currentFileName,
          language: currentLanguage
        });
        break;
        
      case 'pageUnloading':
        // Handle page navigation while recording
        if (isRecording && request.url) {
          recordedActions.push({
            type: 'navigate',
            url: request.url,
            timestamp: Date.now(),
            reason: 'page_unload'
          });
          actionCount++;
          updateStorage();
        }
        sendResponse({ success: true });
        break;
        
      case 'ping':
        // Respond to ping from content script
        sendResponse({ 
          success: true, 
          isRecording: isRecording,
          actionCount: actionCount
        });
        break;
        
      case 'forceDownload':
        // Force download of current recording
        if (recordedActions.length > 0) {
          generateTestFile();
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'No actions recorded' });
        }
        break;
    }
  } catch (error) {
    console.error('Error processing message:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true; // Keep message channel open for async response
});

function startRecording(fileName, language) {
  console.log('=== START RECORDING ===');
  console.log('Starting recording for:', fileName, 'language:', language);
  
  isRecording = true;
  recordedActions = [];
  actionCount = 0;
  currentFileName = fileName;
  currentLanguage = language;
  recordingStartTime = Date.now();
  
  console.log('Recording state set:', { isRecording, fileName, language });
  updateStorage();
  
  // Get current tab and store its ID
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    console.log('Found tabs:', tabs);
    if (tabs[0]) {
      currentTabId = tabs[0].id;
      const tabUrl = tabs[0].url || '';
      console.log('Current tab:', { id: currentTabId, url: tabUrl });
      
      if (!tabUrl.startsWith('http://') && !tabUrl.startsWith('https://')) {
        console.warn('Cannot inject content script into non-web page:', tabUrl);
        chrome.runtime.sendMessage({
          action: 'recordingError',
          message: 'Recording is only supported on regular web pages (http/https). This page is not supported.'
        });
        return;
      }
      console.log('Recording in tab:', currentTabId);
      
      // Inject content script to start recording
      console.log('Sending startRecording message to content script...');
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'startRecording'
      }, (response) => {
        console.log('Content script response:', response);
        if (chrome.runtime.lastError) {
          console.warn('Failed to start recording in content script:', chrome.runtime.lastError);
          // Try to inject content script if it's not loaded
          console.log('Attempting to inject content script...');
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content.js']
          }, () => {
            console.log('Content script injection completed');
            // Retry sending message after injection
            setTimeout(() => {
              console.log('Retrying startRecording message...');
              chrome.tabs.sendMessage(tabs[0].id, {
                action: 'startRecording'
              }, (retryResponse) => {
                console.log('Retry response:', retryResponse);
                if (chrome.runtime.lastError) {
                  console.error('Failed to start recording after injection:', chrome.runtime.lastError);
                  isRecording = false; // Stop recording if we can't communicate
                } else {
                  console.log('Recording started successfully after injection');
                }
              });
            }, 200);
          });
        } else {
          console.log('Recording started successfully');
        }
      });
      
      // Start heartbeat to maintain recording state
      console.log('Starting heartbeat...');
      startHeartbeat();
      startRecordingPersistence();
    } else {
      console.error('No active tab found');
      isRecording = false;
    }
  });
  
  console.log('=== END START RECORDING ===');
}

function startHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  
  heartbeatInterval = setInterval(() => {
    if (isRecording && currentTabId) {
      try {
        chrome.tabs.sendMessage(currentTabId, { action: 'forceReconnect' }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('Heartbeat failed, attempting to reconnect...');
            // Try to inject content script again
            try {
              chrome.scripting.executeScript({
                target: { tabId: currentTabId },
                files: ['content.js']
              }, () => {
                setTimeout(() => {
                  try {
                    chrome.tabs.sendMessage(currentTabId, { action: 'startRecording' });
                  } catch (error) {
                    console.error('Error in heartbeat reconnection:', error);
                  }
                }, 100);
              });
            } catch (error) {
              console.error('Error injecting content script in heartbeat:', error);
            }
          }
        });
      } catch (error) {
        console.error('Error in heartbeat:', error);
      }
    }
  }, 3000); // Heartbeat every 3 seconds
}

function startRecordingPersistence() {
  if (recordingPersistenceInterval) {
    clearInterval(recordingPersistenceInterval);
  }
  
  recordingPersistenceInterval = setInterval(() => {
    if (isRecording) {
      updateStorage();
      console.log('Recording state persisted. Actions:', actionCount);
    }
  }, 5000); // Persist every 5 seconds
}

function stopRecording() {
  console.log('Stopping recording...');
  isRecording = false;
  
  // Stop heartbeat and persistence
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  
  if (recordingPersistenceInterval) {
    clearInterval(recordingPersistenceInterval);
    recordingPersistenceInterval = null;
  }
  
  // Stop recording in content script
  if (currentTabId) {
    chrome.tabs.sendMessage(currentTabId, {
      action: 'stopRecording'
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('Failed to stop recording in content script:', chrome.runtime.lastError);
      }
    });
  }
  
  // Generate and download the test file
  if (recordedActions.length > 0) {
    generateTestFile();
  } else {
    console.log('No actions recorded, skipping file generation');
  }
  
  updateStorage();
  console.log('Recording stopped. Generated', actionCount, 'actions');
  
  // Reset tab tracking
  currentTabId = null;
  recordingStartTime = null;
}

function generateTestFile() {
  console.log('Generating test file with', recordedActions.length, 'actions');
  const testCode = generatePlaywrightCode(recordedActions, currentLanguage);
  const fileName = `${currentFileName}.spec.js`;
  
  downloadFile(testCode, fileName);
}

function generateScriptFromActions(actions, fileName, language) {
  console.log('Generating script from', actions.length, 'actions');
  const testCode = generatePlaywrightCode(actions, language);
  const fullFileName = `${fileName}.spec.js`;
  
  downloadFile(testCode, fullFileName);
}

function downloadFile(content, fileName) {
  console.log('Attempting to download file:', fileName);
  
  // Create a data URL instead of using URL.createObjectURL
  const dataUrl = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(content);
  
  chrome.downloads.download({
    url: dataUrl,
    filename: fileName,
    saveAs: true
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('Download failed:', chrome.runtime.lastError);
      
      // Retry download if it failed
      if (downloadRetryCount < maxDownloadRetries) {
        downloadRetryCount++;
        console.log(`Retrying download (attempt ${downloadRetryCount}/${maxDownloadRetries})...`);
        setTimeout(() => {
          downloadFile(content, fileName);
        }, 1000);
      } else {
        console.error('Max download retries reached');
        downloadRetryCount = 0;
        
        // Try alternative download method
        tryAlternativeDownload(content, fileName);
      }
    } else {
      console.log('Test file downloaded successfully:', fileName, 'Download ID:', downloadId);
      downloadRetryCount = 0;
    }
  });
}

function tryAlternativeDownload(content, fileName) {
  console.log('Trying alternative download method...');
  
  // Try with different MIME type
  const dataUrl = 'data:application/javascript;charset=utf-8,' + encodeURIComponent(content);
  
  chrome.downloads.download({
    url: dataUrl,
    filename: fileName,
    saveAs: true
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('Alternative download also failed:', chrome.runtime.lastError);
      
      // Last resort: try to copy to clipboard and notify user
      try {
        navigator.clipboard.writeText(content).then(() => {
          console.log('Content copied to clipboard as fallback');
          // Show notification to user
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.png',
            title: 'Playwright Recorder',
            message: `Test file copied to clipboard. File: ${fileName}`
          });
        });
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
      }
    } else {
      console.log('Alternative download successful:', fileName);
    }
  });
}

function generatePlaywrightCode(actions, language) {
  let code = '';
  
  switch (language) {
    case 'javascript':
      code = generateJavaScriptCode(actions);
      break;
    case 'typescript':
      code = generateTypeScriptCode(actions);
      break;
    case 'python':
      code = generatePythonCode(actions);
      break;
    case 'java':
      code = generateJavaCode(actions);
      break;
    default:
      code = generateJavaScriptCode(actions);
  }
  
  return code;
}

function playwrightLocatorCode(selectorObj, framePrefix = 'page.') {
  switch (selectorObj.type) {
    case 'id':
      return `${framePrefix}locator('${selectorObj.value}')`;
    case 'getByRole':
      return `${framePrefix}getByRole('${selectorObj.value}', { name: '${selectorObj.name}' })`;
    case 'getByLabel':
      return `${framePrefix}getByLabel('${selectorObj.value}')`;
    case 'getByPlaceholder':
      return `${framePrefix}getByPlaceholder('${selectorObj.value}')`;
    case 'getByAltText':
      return `${framePrefix}getByAltText('${selectorObj.value}')`;
    case 'getByTitle':
      return `${framePrefix}getByTitle('${selectorObj.value}')`;
    case 'getByTestId':
      return `${framePrefix}getByTestId('${selectorObj.value}')`;
    case 'class-attr':
      return `${framePrefix}locator('${selectorObj.value}')`;
    case 'name':
      return `${framePrefix}locator('[name="${selectorObj.value}"]')`;
    case 'class':
      return `${framePrefix}locator('${selectorObj.value}')`;
    case 'css':
    default:
      return `${framePrefix}locator('${selectorObj.value}')`;
  }
}

function generateJavaScriptCode(actions) {
  // Remove hover actions
  const filteredActions = actions.filter(a => a.type !== 'hover');

  // Find the first navigation action
  const firstNavIdx = filteredActions.findIndex(a => a.type === 'navigate');
  let actionsToUse = filteredActions;
  if (firstNavIdx !== -1) {
    // Only include actions from the first navigation onwards
    actionsToUse = filteredActions.slice(firstNavIdx);
  }

  let code = `import { test, expect } from '@playwright/test';\n\n`;
  code += `test('Recorded Test - ${currentFileName}', async ({ page }) => {\n`;

  let stepBuffer = [];
  let stepDescription = '';
  let lastNavigatedUrl = null;
  const seenNavigations = new Set();

  // Helper to flush the current step buffer
  function flushStep() {
    if (stepBuffer.length > 0 && stepDescription) {
      code += `  await test.step(${JSON.stringify(stepDescription)}, async () => {\n`;
      code += stepBuffer.join('');
      code += `  });\n\n`;
      stepBuffer = [];
      stepDescription = '';
    }
  }

  for (let i = 0; i < actionsToUse.length; i++) {
    const action = actionsToUse[i];
    // Only insert navigation if it's a new URL
    if (action.type === 'navigate' && !seenNavigations.has(action.url)) {
      flushStep();
      stepDescription = `Go to ${action.url}`;
      stepBuffer.push(`    await page.goto('${action.url}');\n`);
      stepBuffer.push(`    await page.waitForTimeout(3000);\n`);
      lastNavigatedUrl = action.url;
      seenNavigations.add(action.url);
      flushStep();
      continue;
    }
    // Skip duplicate navigation
    if (action.type === 'navigate') {
      continue;
    }
    // Group actions under the last navigation
    let description = '';
    switch (action.type) {
      case 'click':
        description = `Click on ${action.selector?.value || action.selector}`;
        break;
      case 'type':
        description = `Type in ${action.selector?.value || action.selector}`;
        break;
      case 'select':
        description = `Select option in ${action.selector?.value || action.selector}`;
        break;
      case 'check':
        description = `Check ${action.selector?.value || action.selector}`;
        break;
      case 'upload':
        description = `Upload file to ${action.selector?.value || action.selector}`;
        break;
      case 'submit':
        description = `Submit form ${action.selector?.value || action.selector}`;
        break;
      default:
        description = `${action.type} on ${action.selector?.value || action.selector}`;
    }
    if (!stepDescription) stepDescription = description;

    // Generate Playwright code for the action
    let line = '';
    const framePrefix = generateFramePrefix(action.framePath);
    // Prioritize unique ID over getByTestId
    let selectorObj = action.selector || { type: 'css', value: action.selector };
    if (action.selector && action.selector.type === 'getByTestId') {
      // If a unique ID is available, use it instead
      if (action.elementId && action.elementId.trim()) {
        selectorObj = { type: 'id', value: `#${action.elementId}` };
      }
    }
    switch (action.type) {
      case 'click':
        line = `    await ${playwrightLocatorCode(selectorObj, framePrefix)}.click({ force: true });\n`;
        break;
      case 'type':
        line = `    await ${playwrightLocatorCode(selectorObj, framePrefix)}.fill('${action.value || ''}');\n`;
        line += `    await page.waitForTimeout(3000);\n`;
        break;
      case 'select':
        line = `    await ${playwrightLocatorCode(selectorObj, framePrefix)}.selectOption('${action.value || ''}');\n`;
        break;
      case 'check':
        if (action.inputType === 'checkbox') {
          if (action.checked) {
            line = `    await ${playwrightLocatorCode(selectorObj, framePrefix)}.check();\n`;
          } else {
            line = `    await ${playwrightLocatorCode(selectorObj, framePrefix)}.uncheck();\n`;
          }
        } else if (action.inputType === 'radio') {
          line = `    await ${playwrightLocatorCode(selectorObj, framePrefix)}.check();\n`;
        }
        break;
      case 'upload':
        line = `    await ${playwrightLocatorCode(selectorObj, framePrefix)}.setInputFiles('path/to/your/file');\n`;
        break;
      case 'submit':
        line = `    await ${playwrightLocatorCode(selectorObj, framePrefix)}.locator('button[type=\"submit\"]').click({ force: true });\n`;
        break;
      case 'keypress':
        if (action.key) {
          if (action.selector && action.selector.value && action.selector.value !== 'body') {
            line = `    await ${playwrightLocatorCode(selectorObj, framePrefix)}.press('${action.key}');\n`;
          } else {
            line = `    await page.keyboard.press('${action.key}');\n`;
          }
        }
        break;
      case 'scroll':
        line = `    await ${framePrefix}evaluate(() => window.scrollTo(${action.scrollX}, ${action.scrollY}));\n`;
        break;
      // Add more cases as needed
    }
    // If the next action is a navigation to a new URL, insert a wait after this action
    const nextAction = actionsToUse[i + 1];
    if (nextAction && nextAction.type === 'navigate' && nextAction.url !== lastNavigatedUrl) {
      line += `    await page.waitForTimeout(3000);\n`;
    }
    stepBuffer.push(line);
  }
  flushStep();
  code += `});\n`;
  return code;
}

// Function to clean actions for code generation
function cleanActionsForCode(actions) {
  const cleaned = [];
  let lastUrl = '';
  let lastAction = null;
  
  actions.forEach((action, index) => {
    // Skip duplicate actions
    if (lastAction && 
        lastAction.type === action.type && 
        lastAction.selector === action.selector &&
        action.timestamp - lastAction.timestamp < 1000) {
      return;
    }
    
    // Skip redundant navigation
    if (action.type === 'navigate') {
      if (action.url === lastUrl) {
        return;
      }
      lastUrl = action.url;
    }
    
    // Skip unnecessary hover/focus/blur events
    if (['hover', 'focus', 'blur'].includes(action.type)) {
      if (!action.hasTooltip && !action.isImportant && !['input', 'textarea', 'select'].includes(action.elementType)) {
        return;
      }
    }
    
    // Skip insignificant scroll events
    if (action.type === 'scroll' && action.scrollDiff < 100) {
      return;
    }
    
    cleaned.push(action);
    lastAction = action;
  });
  
  return cleaned;
}

// Function to get key description
function getKeyDescription(key, modifiers = {}) {
  const descriptions = {
    'c': 'Copy',
    'v': 'Paste', 
    'x': 'Cut',
    'a': 'Select All',
    'enter': 'Press Enter',
    'escape': 'Press Escape',
    'tab': 'Press Tab',
    'arrowup': 'Press Up Arrow',
    'arrowdown': 'Press Down Arrow',
    'arrowleft': 'Press Left Arrow',
    'arrowright': 'Press Right Arrow'
  };
  
  let description = descriptions[key] || `Press ${key}`;
  
  if (modifiers.ctrl || modifiers.meta) {
    description = `Ctrl+${description}`;
  }
  if (modifiers.shift) {
    description = `Shift+${description}`;
  }
  if (modifiers.alt) {
    description = `Alt+${description}`;
  }
  
  return description;
}

// Helper function to generate frame prefix for Playwright code
function generateFramePrefix(framePath) {
  if (!framePath || framePath.length === 0) {
    return 'page.';
  }
  
  let prefix = 'page.';
  
  framePath.forEach((frame, index) => {
    if (frame.type === 'iframe') {
      prefix += `frameLocator('${frame.selector}').`;
    } else if (frame.type === 'shadow') {
      prefix += `locator('${frame.selector}').shadowRoot.`;
    }
  });
  
  return prefix;
}

function generateTypeScriptCode(actions) {
  let code = `import { test, expect } from '@playwright/test';

test('Recorded Test - ${currentFileName}', async ({ page }) => {
  // Navigate to the starting URL
  await page.goto('${actions[0]?.url || 'https://example.com'}');
  
`;

  actions.forEach((action) => {
    // Handle frame context
    const framePrefix = generateFramePrefix(action.framePath);
    
    switch (action.type) {
      case 'click':
        code += `  // Click on ${action.selector}\n`;
        code += `  await ${framePrefix}click('${action.selector}');\n\n`;
        break;
      case 'doubleClick':
        code += `  // Double-click on ${action.selector}\n`;
        code += `  await ${framePrefix}dblclick('${action.selector}');\n\n`;
        break;
      case 'rightClick':
        code += `  // Right-click on ${action.selector}\n`;
        code += `  await ${framePrefix}click('${action.selector}', { button: 'right' });\n\n`;
        break;
      case 'type':
        code += `  // Type in ${action.selector}\n`;
        code += `  await ${framePrefix}fill('${action.selector}', '${action.value || ''}');\n\n`;
        break;
      case 'check':
        if (action.inputType === 'checkbox') {
          if (action.checked) {
            code += `  // Check checkbox ${action.selector}\n`;
            code += `  await ${framePrefix}check('${action.selector}');\n\n`;
          } else {
            code += `  // Uncheck checkbox ${action.selector}\n`;
            code += `  await ${framePrefix}uncheck('${action.selector}');\n\n`;
          }
        } else if (action.inputType === 'radio') {
          code += `  // Select radio button ${action.selector}\n`;
          code += `  await ${framePrefix}check('${action.selector}');\n\n`;
        }
        break;
      case 'select':
        if (action.multiple) {
          code += `  // Select multiple options in ${action.selector}\n`;
          code += `  await ${framePrefix}selectOption('${action.selector}', ${JSON.stringify(action.value)});\n\n`;
        } else {
          code += `  // Select option in ${action.selector}\n`;
          code += `  await ${framePrefix}selectOption('${action.selector}', '${action.value || ''}');\n\n`;
        }
        break;
      case 'upload':
        code += `  // Upload file to ${action.selector}\n`;
        code += `  await ${framePrefix}setInputFiles('${action.selector}', 'path/to/your/file');\n\n`;
        break;
      case 'navigate':
        code += `  // Navigate to ${action.url}\n`;
        code += `  await page.goto('${action.url}');\n\n`;
        break;
      case 'hover':
        code += `  // Hover over ${action.selector}\n`;
        code += `  await ${framePrefix}hover('${action.selector}');\n\n`;
        break;
      case 'focus':
        code += `  // Focus on ${action.selector}\n`;
        code += `  await ${framePrefix}focus('${action.selector}');\n\n`;
        break;
      case 'blur':
        code += `  // Blur from ${action.selector}\n`;
        code += `  await ${framePrefix}evaluate(() => document.querySelector('${action.selector}').blur());\n\n`;
        break;
      case 'wait':
        code += `  // Wait for ${action.selector}\n`;
        code += `  await ${framePrefix}waitForSelector('${action.selector}');\n\n`;
        break;
      case 'keypress':
        code += `  // Press key ${action.key} on ${action.selector}\n`;
        code += `  await ${framePrefix}press('${action.selector}', '${action.key}');\n\n`;
        break;
      case 'scroll':
        code += `  // Scroll to position (${action.scrollX}, ${action.scrollY})\n`;
        code += `  await ${framePrefix}evaluate(() => window.scrollTo(${action.scrollX}, ${action.scrollY}));\n\n`;
        break;
      case 'dragStart':
        code += `  // Start dragging ${action.selector}\n`;
        code += `  await ${framePrefix}dragAndDrop('${action.selector}', '${action.selector}');\n\n`;
        break;
      case 'drop':
        code += `  // Drop on ${action.selector}\n`;
        code += `  // Note: Drag and drop requires source and target selectors\n\n`;
        break;
      case 'submit':
        code += `  // Submit form ${action.selector}\n`;
        code += `  await ${framePrefix}click('${action.selector} button[type="submit"]');\n\n`;
        break;
    }
  });
  
  code += `  // Add your assertions here
  // await expect(page.locator('selector')).toBeVisible();
});
`;
  
  return code;
}

function generatePythonCode(actions) {
  let code = `from playwright.sync_api import sync_playwright, expect

def test_recorded_${currentFileName.replace('-', '_')}():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        
        # Navigate to the starting URL
        page.goto('${actions[0]?.url || 'https://example.com'}')
        
`;

  actions.forEach((action) => {
    // Handle frame context
    const framePrefix = generatePythonFramePrefix(action.framePath);
    
    switch (action.type) {
      case 'click':
        code += `        # Click on ${action.selector}\n`;
        code += `        ${framePrefix}click('${action.selector}')\n\n`;
        break;
      case 'doubleClick':
        code += `        # Double-click on ${action.selector}\n`;
        code += `        ${framePrefix}dblclick('${action.selector}')\n\n`;
        break;
      case 'rightClick':
        code += `        # Right-click on ${action.selector}\n`;
        code += `        ${framePrefix}click('${action.selector}', button='right')\n\n`;
        break;
      case 'type':
        code += `        # Type in ${action.selector}\n`;
        code += `        ${framePrefix}fill('${action.selector}', '${action.value || ''}')\n\n`;
        break;
      case 'check':
        if (action.inputType === 'checkbox') {
          if (action.checked) {
            code += `        # Check checkbox ${action.selector}\n`;
            code += `        ${framePrefix}check('${action.selector}')\n\n`;
          } else {
            code += `        # Uncheck checkbox ${action.selector}\n`;
            code += `        ${framePrefix}uncheck('${action.selector}')\n\n`;
          }
        } else if (action.inputType === 'radio') {
          code += `        # Select radio button ${action.selector}\n`;
          code += `        ${framePrefix}check('${action.selector}')\n\n`;
        }
        break;
      case 'select':
        if (action.multiple) {
          code += `        # Select multiple options in ${action.selector}\n`;
          code += `        ${framePrefix}select_option('${action.selector}', ${JSON.stringify(action.value)})\n\n`;
        } else {
          code += `        # Select option in ${action.selector}\n`;
          code += `        ${framePrefix}select_option('${action.selector}', '${action.value || ''}')\n\n`;
        }
        break;
      case 'upload':
        code += `        # Upload file to ${action.selector}\n`;
        code += `        ${framePrefix}set_input_files('${action.selector}', 'path/to/your/file')\n\n`;
        break;
      case 'navigate':
        code += `        # Navigate to ${action.url}\n`;
        code += `        page.goto('${action.url}')\n\n`;
        break;
      case 'hover':
        code += `        # Hover over ${action.selector}\n`;
        code += `        ${framePrefix}hover('${action.selector}')\n\n`;
        break;
      case 'focus':
        code += `        # Focus on ${action.selector}\n`;
        code += `        ${framePrefix}focus('${action.selector}')\n\n`;
        break;
      case 'blur':
        code += `        # Blur from ${action.selector}\n`;
        code += `        ${framePrefix}evaluate("document.querySelector('${action.selector}').blur()")\n\n`;
        break;
      case 'wait':
        code += `        # Wait for ${action.selector}\n`;
        code += `        ${framePrefix}wait_for_selector('${action.selector}')\n\n`;
        break;
      case 'keypress':
        code += `        # Press key ${action.key} on ${action.selector}\n`;
        code += `        ${framePrefix}press('${action.selector}', '${action.key}')\n\n`;
        break;
      case 'scroll':
        code += `        # Scroll to position (${action.scrollX}, ${action.scrollY})\n`;
        code += `        ${framePrefix}evaluate(f"window.scrollTo({action.scrollX}, {action.scrollY})")\n\n`;
        break;
      case 'dragStart':
        code += `        # Start dragging ${action.selector}\n`;
        code += `        ${framePrefix}drag_and_drop('${action.selector}', '${action.selector}')\n\n`;
        break;
      case 'drop':
        code += `        # Drop on ${action.selector}\n`;
        code += `        # Note: Drag and drop requires source and target selectors\n\n`;
        break;
      case 'submit':
        code += `        # Submit form ${action.selector}\n`;
        code += `        ${framePrefix}click('${action.selector} button[type="submit"]')\n\n`;
        break;
    }
  });
  
  code += `        # Add your assertions here
        # expect(page.locator('selector')).to_be_visible()
        
        browser.close()
`;
  
  return code;
}

// Helper function to generate frame prefix for Python code
function generatePythonFramePrefix(framePath) {
  if (!framePath || framePath.length === 0) {
    return 'page.';
  }
  
  let prefix = 'page.';
  
  framePath.forEach((frame, index) => {
    if (frame.type === 'iframe') {
      prefix += `frame_locator('${frame.selector}').`;
    } else if (frame.type === 'shadow') {
      prefix += `locator('${frame.selector}').shadow_root.`;
    }
  });
  
  return prefix;
}

function generateJavaCode(actions) {
  let code = `import com.microsoft.playwright.*;

public class ${currentFileName.replace('-', '_').replace(/[^a-zA-Z0-9_]/g, '')}Test {
    public static void main(String[] args) {
        try (Playwright playwright = Playwright.create()) {
            Browser browser = playwright.chromium().launch();
            Page page = browser.newPage();
            
            // Navigate to the starting URL
            page.navigate("${actions[0]?.url || 'https://example.com'}");
            
`;

  actions.forEach((action) => {
    // Handle frame context
    const framePrefix = generateJavaFramePrefix(action.framePath);
    
    switch (action.type) {
      case 'click':
        code += `            // Click on ${action.selector}\n`;
        code += `            ${framePrefix}click("${action.selector}");\n\n`;
        break;
      case 'doubleClick':
        code += `            // Double-click on ${action.selector}\n`;
        code += `            ${framePrefix}dblclick("${action.selector}");\n\n`;
        break;
      case 'rightClick':
        code += `            // Right-click on ${action.selector}\n`;
        code += `            ${framePrefix}click("${action.selector}", new Page.ClickOptions().setButton(MouseButton.RIGHT));\n\n`;
        break;
      case 'type':
        code += `            // Type in ${action.selector}\n`;
        code += `            ${framePrefix}fill("${action.selector}", "${action.value || ''}");\n\n`;
        break;
      case 'check':
        if (action.inputType === 'checkbox') {
          if (action.checked) {
            code += `            // Check checkbox ${action.selector}\n`;
            code += `            ${framePrefix}check("${action.selector}");\n\n`;
          } else {
            code += `            // Uncheck checkbox ${action.selector}\n`;
            code += `            ${framePrefix}uncheck("${action.selector}");\n\n`;
          }
        } else if (action.inputType === 'radio') {
          code += `            // Select radio button ${action.selector}\n`;
          code += `            ${framePrefix}check("${action.selector}");\n\n`;
        }
        break;
      case 'select':
        if (action.multiple) {
          code += `            // Select multiple options in ${action.selector}\n`;
          code += `            ${framePrefix}selectOption("${action.selector}", ${JSON.stringify(action.value)});\n\n`;
        } else {
          code += `            // Select option in ${action.selector}\n`;
          code += `            ${framePrefix}selectOption("${action.selector}", "${action.value || ''}");\n\n`;
        }
        break;
      case 'upload':
        code += `            // Upload file to ${action.selector}\n`;
        code += `            ${framePrefix}setInputFiles("${action.selector}", "path/to/your/file");\n\n`;
        break;
      case 'navigate':
        code += `            // Navigate to ${action.url}\n`;
        code += `            page.navigate("${action.url}");\n\n`;
        break;
      case 'hover':
        code += `            // Hover over ${action.selector}\n`;
        code += `            ${framePrefix}hover("${action.selector}");\n\n`;
        break;
      case 'focus':
        code += `            // Focus on ${action.selector}\n`;
        code += `            ${framePrefix}focus("${action.selector}");\n\n`;
        break;
      case 'blur':
        code += `            // Blur from ${action.selector}\n`;
        code += `            ${framePrefix}evaluate("document.querySelector('${action.selector}').blur()");\n\n`;
        break;
      case 'wait':
        // No-op for wait
        break;
      case 'keypress':
        code += `            // Press key ${action.key} on ${action.selector}\n`;
        code += `            ${framePrefix}press('${action.selector}', '${action.key}');\n\n`;
        break;
      case 'scroll':
        code += `            // Scroll to position (${action.scrollX}, ${action.scrollY})\n`;
        code += `            ${framePrefix}evaluate(f"window.scrollTo({action.scrollX}, {action.scrollY})")\n\n`;
        break;
      case 'dragStart':
        code += `            // Start dragging ${action.selector}\n`;
        code += `            ${framePrefix}drag_and_drop('${action.selector}', '${action.selector}')\n\n`;
        break;
      case 'drop':
        code += `            // Drop on ${action.selector}\n`;
        code += `            // Note: Drag and drop requires source and target selectors\n\n`;
        break;
      case 'submit':
        code += `            // Submit form ${action.selector}\n`;
        code += `            ${framePrefix}click('${action.selector} button[type="submit"]')\n\n`;
        break;
    }
  });
  
  code += `            // Add your assertions here
            // await expect(page.locator('selector')).to_be_visible()
            
            browser.close()
`;
  
  return code;
}

// Helper function to generate frame prefix for Java code
function generateJavaFramePrefix(framePath) {
  if (!framePath || framePath.length === 0) {
    return 'page.';
  }
  
  let prefix = 'page.';
  
  framePath.forEach((frame, index) => {
    if (frame.type === 'iframe') {
      prefix += `frameLocator('${frame.selector}').`;
    } else if (frame.type === 'shadow') {
      prefix += `locator('${frame.selector}').shadowRoot.`;
    }
  });
  
  return prefix;
}