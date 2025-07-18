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
let initialPageUrl = null; // Store the initial page URL when recording starts

// AI-powered code generation configuration
const AI_CONFIG = {
  enabled: true,
  apiEndpoint: 'https://api.openai.com/v1/chat/completions', // Can be changed to other AI providers
  model: 'gpt-4',
  maxTokens: 4000,
  temperature: 0.3
};

// AI API key (should be stored securely in production)
let aiApiKey = null;

// Load AI configuration on startup
chrome.storage.sync.get(['aiEnabled', 'aiApiKey', 'aiModel'], function(result) {
  if (result.aiEnabled && result.aiApiKey) {
    aiApiKey = result.aiApiKey;
    AI_CONFIG.model = result.aiModel || 'gpt-4';
    console.log('AI configuration loaded');
  }
});

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
        try {
          startRecording(request.fileName, request.language);
          // Send immediate response to popup
          sendResponse({ 
            success: true, 
            actionCount: actionCount,
            fileName: currentFileName
          });
        } catch (error) {
          console.error('Error starting recording:', error);
          sendResponse({ 
            success: false, 
            error: error.message 
          });
        }
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
        generateScriptFromActions(request.actions, request.fileName, request.language)
          .then(() => {
            sendResponse({ 
              success: true, 
              fileName: `${request.fileName}.spec.js`
            });
          })
          .catch(error => {
            console.error('Script generation failed:', error);
            sendResponse({ 
              success: false, 
              error: error.message 
            });
          });
        return true; // Keep message channel open for async response
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
        
      case 'validateAI':
        validateAIConnection(request.apiKey, request.model)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep message channel open for async response
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
      initialPageUrl = tabUrl; // Store the initial page URL
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
  initialPageUrl = null; // Reset initial page URL
}

async function generateTestFile() {
  console.log('Generating test file with', recordedActions.length, 'actions');
  try {
    const testCode = await generatePlaywrightCode(recordedActions, currentLanguage);
    const fileName = `${currentFileName}.spec.js`;
    
    downloadFile(testCode, fileName);
  } catch (error) {
    console.error('Error generating test file:', error);
    // Fallback to traditional generation
    const testCode = generateTraditionalCode(recordedActions, currentLanguage);
    const fileName = `${currentFileName}.spec.js`;
    downloadFile(testCode, fileName);
  }
}

async function generateScriptFromActions(actions, fileName, language) {
  console.log('Generating script from', actions.length, 'actions');
  try {
    const testCode = await generatePlaywrightCode(actions, language);
    const fullFileName = `${fileName}.spec.js`;
    
    downloadFile(testCode, fullFileName);
  } catch (error) {
    console.error('Error generating script:', error);
    // Fallback to traditional generation
    const testCode = generateTraditionalCode(actions, language);
    const fullFileName = `${fileName}.spec.js`;
    downloadFile(testCode, fullFileName);
  }
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

async function generatePlaywrightCode(actions, language) {
  if (AI_CONFIG.enabled && aiApiKey) {
    return await generateAIPoweredCode(actions, language);
  } else {
    return generateTraditionalCode(actions, language);
  }
}

// Add a function to review code with AI
async function reviewCodeWithAI(code, language) {
  const reviewPrompt = {
    role: "system",
    content: `You are an expert code reviewer. Review the following ${language} code for best practices, readability, and robustness. Suggest improvements and return the improved code only.\n\nCode:\n${code}`
  };
  try {
    const aiResponse = await callAIAPI(reviewPrompt);
    if (aiResponse && aiResponse.code) {
      return aiResponse.code;
    } else {
      console.warn('AI review failed, returning original code');
      return code;
    }
  } catch (error) {
    console.error('AI code review error:', error);
    return code;
  }
}

async function generateAIPoweredCode(actions, language) {
  try {
    console.log('Generating AI-powered code for', actions.length, 'actions');
    
    // Prepare context for AI
    const context = prepareAIContext(actions, language);
    
    // Generate AI prompt
    const prompt = createAIPrompt(context);
    
    // Call AI API to generate code
    const aiResponse = await callAIAPI(prompt);
    
    let code = aiResponse && aiResponse.code ? aiResponse.code : null;
    if (!code) {
      console.warn('AI generation failed, falling back to traditional generation');
      return generateTraditionalCode(actions, language);
    }
    // Automatically review and improve the code with AI
    code = await reviewCodeWithAI(code, language);
    return code;
  } catch (error) {
    console.error('AI code generation error:', error);
    return generateTraditionalCode(actions, language);
  }
}

function prepareAIContext(actions, language) {
  // Extract meaningful context from actions
  const context = {
    language: language,
    totalActions: actions.length,
    actionTypes: {},
    pageUrls: new Set(),
    formInteractions: [],
    navigationFlow: [],
    elementTypes: new Set(),
    userIntent: inferUserIntent(actions),
    actions: actions // Include the actual actions for the prompt
  };
  
  actions.forEach((action, index) => {
    // Count action types
    context.actionTypes[action.type] = (context.actionTypes[action.type] || 0) + 1;
    
    // Track URLs
    if (action.url) context.pageUrls.add(action.url);
    
    // Track form interactions
    if (['type', 'select', 'check', 'submit'].includes(action.type)) {
      context.formInteractions.push({
        index,
        type: action.type,
        selector: action.selector,
        value: action.value,
        tagName: action.tagName
      });
    }
    
    // Track navigation
    if (action.type === 'navigate') {
      context.navigationFlow.push({
        index,
        url: action.url
      });
    }
    
    // Track element types
    if (action.tagName) context.elementTypes.add(action.tagName);
  });
  
  return context;
}

function inferUserIntent(actions) {
  // Analyze actions to understand user intent
  const intent = {
    isFormSubmission: false,
    isDataEntry: false,
    isNavigation: false,
    isSearch: false,
    isFileUpload: false,
    workflowType: 'general'
  };
  
  const formActions = actions.filter(a => ['type', 'select', 'check', 'submit'].includes(a.type));
  const navigationActions = actions.filter(a => a.type === 'navigate');
  const searchKeywords = ['search', 'query', 'find', 'lookup'];
  
  if (formActions.length > 0) {
    intent.isFormSubmission = formActions.some(a => a.type === 'submit');
    intent.isDataEntry = formActions.length > 2;
  }
  
  if (navigationActions.length > 0) {
    intent.isNavigation = true;
  }
  
  // Check for search patterns
  const searchActions = actions.filter(a => 
    a.type === 'type' && 
    searchKeywords.some(keyword => 
      (a.selector?.value || '').toLowerCase().includes(keyword) ||
      (a.text || '').toLowerCase().includes(keyword)
    )
  );
  
  if (searchActions.length > 0) {
    intent.isSearch = true;
  }
  
  // Determine workflow type
  if (intent.isFormSubmission && intent.isDataEntry) {
    intent.workflowType = 'form_submission';
  } else if (intent.isSearch) {
    intent.workflowType = 'search';
  } else if (intent.isNavigation) {
    intent.workflowType = 'navigation';
  }
  
  return intent;
}

function createAIPrompt(context) {
  const actionsDescription = context.actions?.map((action, index) => 
    `${index + 1}. ${action.type} on ${action.selector?.value || action.selector}${action.value ? ` with value "${action.value}"` : ''}${action.url ? ` (URL: ${action.url})` : ''}`
  ).join('\n') || 'No actions recorded';
  
  // Get initial URL from the first action or use a placeholder
  const initialUrl = context.actions?.[0]?.url || 'https://your-target-page.com';
  
  return {
    role: "system",
    content: `You are an expert Playwright test automation engineer. Generate high-quality, production-ready test code based on the recorded user actions.

IMPORTANT REQUIREMENTS:
1. **Chronological Order**: Actions must be generated in the exact order they were recorded
2. **Navigation Handling**: Only include explicit navigation actions (page.goto) when the user actually navigated to a new URL
3. **Page Grouping**: Group actions by the page they occur on, with navigation steps before page-specific actions
4. **No Initial URL**: Do NOT start with the current page URL as a goto statement unless it was explicitly navigated to
5. **Logical Steps**: Group related actions (like typing sequences) into meaningful test steps
6. **Robust Selectors**: Use semantic selectors (getByRole, getByLabel, getByPlaceholder) over CSS selectors
7. **Smart Assertions**: Add relevant assertions based on the workflow context
8. **Proper Waits**: Include appropriate waits after navigation and form submissions

Context:
- Language: ${context.language}
- Total Actions: ${context.totalActions}
- Action Types: ${JSON.stringify(context.actionTypes)}
- User Intent: ${JSON.stringify(context.userIntent)}
- Workflow Type: ${context.workflowType}
- Initial Page URL: ${initialUrl}

Recorded Actions (in chronological order):
${actionsDescription}

Generate a complete, runnable test file that follows Playwright best practices and respects the chronological order of actions.`
  };
}

async function callAIAPI(prompt) {
  try {
    const response = await fetch(AI_CONFIG.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiApiKey}`
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        messages: [prompt],
        max_tokens: AI_CONFIG.maxTokens,
        temperature: AI_CONFIG.temperature
      })
    });
    
    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const generatedCode = data.choices[0]?.message?.content;
    
    if (generatedCode) {
      return { code: generatedCode };
    } else {
      throw new Error('No code generated from AI');
    }
  } catch (error) {
    console.error('AI API call failed:', error);
    throw error;
  }
}

async function validateAIConnection(apiKey, model) {
  try {
    console.log('Validating AI connection...');
    
    const testPrompt = {
      role: "system",
      content: "You are a test validator. Respond with 'OK' if you receive this message."
    };
    
    const response = await fetch(AI_CONFIG.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || AI_CONFIG.model,
        messages: [testPrompt],
        max_tokens: 10,
        temperature: 0
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API Error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    if (data.choices && data.choices[0]?.message?.content) {
      // Update the stored API key if validation succeeds
      aiApiKey = apiKey;
      AI_CONFIG.model = model || AI_CONFIG.model;
      
      // Save to storage
      chrome.storage.sync.set({
        aiApiKey: apiKey,
        aiModel: model || AI_CONFIG.model
      });
      
      return { success: true };
    } else {
      throw new Error('Invalid API response');
    }
  } catch (error) {
    console.error('AI validation failed:', error);
    return { success: false, error: error.message };
  }
}

function generateTraditionalCode(actions, language) {
  let code = '';
  
  switch (language) {
    case 'javascript':
      code = generateTraditionalJavaScriptCode(actions);
      break;
    case 'typescript':
      code = generateTraditionalTypeScriptCode(actions);
      break;
    case 'python':
      code = generateTraditionalPythonCode(actions);
      break;
    case 'java':
      code = generateTraditionalJavaCode(actions);
      break;
    default:
      code = generateTraditionalJavaScriptCode(actions);
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

function generateTraditionalJavaScriptCode(actions) {
  // Remove hover actions and clean up actions
  const filteredActions = actions.filter(a => a.type !== 'hover');
  const cleanedActions = cleanActionsForCode(filteredActions);

  let code = `import { test, expect } from '@playwright/test';\n\n`;
  code += `test('Recorded Test - ${currentFileName}', async ({ page }) => {\n`;

  let stepBuffer = [];
  let stepDescription = '';
  let currentUrl = null;
  let currentPageActions = [];
  let pageGroups = [];

  // Group actions by page/URL
  for (let i = 0; i < cleanedActions.length; i++) {
    const action = cleanedActions[i];
    
    if (action.type === 'navigate') {
      // If we have actions for the current page, save them
      if (currentPageActions.length > 0) {
        pageGroups.push({
          url: currentUrl,
          actions: [...currentPageActions]
        });
      }
      // Start new page group
      currentUrl = action.url;
      currentPageActions = [];
    } else {
      // Add action to current page
      currentPageActions.push(action);
    }
  }
  
  // Add the last page group if it has actions
  if (currentPageActions.length > 0) {
    pageGroups.push({
      url: currentUrl,
      actions: currentPageActions
    });
  }

  // Generate code for each page group
  for (let groupIndex = 0; groupIndex < pageGroups.length; groupIndex++) {
    const group = pageGroups[groupIndex];
    
    // Always add navigation step for the first group, or if it's a different URL
    if (groupIndex === 0 || group.url) {
      const url = group.url || 'current page';
      code += `  await test.step("Go to ${url}", async () => {\n`;
      if (group.url) {
        code += `    await page.goto('${group.url}');\n`;
        code += `    await page.waitForTimeout(3000);\n`;
              } else {
          // If no URL is provided, use the initial page URL from when recording started
          if (initialPageUrl) {
            code += `    await page.goto('${initialPageUrl}');\n`;
            code += `    await page.waitForTimeout(3000);\n`;
          } else {
            // Fallback - add a comment indicating navigation is needed
            code += `    // TODO: Add navigation to the target page\n`;
            code += `    // await page.goto('https://your-target-page.com');\n`;
            code += `    await page.waitForTimeout(3000);\n`;
          }
        }
      code += `  });\n\n`;
    }

    // Generate actions for this page
    if (group.actions.length > 0) {
      // Group related actions together
      let currentActionGroup = [];
      let groupDescription = '';
      
      for (let actionIndex = 0; actionIndex < group.actions.length; actionIndex++) {
        const action = group.actions[actionIndex];
        
        // Determine if this action should start a new group
        let shouldStartNewGroup = false;
        
        // Start new group for different action types or after certain actions
        if (action.type === 'type' && currentActionGroup.length > 0) {
          const lastAction = currentActionGroup[currentActionGroup.length - 1];
          if (lastAction.type !== 'type' && lastAction.type !== 'keypress') {
            shouldStartNewGroup = true;
          }
        }
        
        // Start new group for form submissions
        if (action.type === 'submit') {
          shouldStartNewGroup = true;
        }
        
        // Flush current group if needed
        if (shouldStartNewGroup && currentActionGroup.length > 0) {
          flushActionGroup(currentActionGroup, groupDescription);
          currentActionGroup = [];
          groupDescription = '';
        }
        
        // Add action to current group
        currentActionGroup.push(action);
        
        // Set group description if not set
        if (!groupDescription) {
          groupDescription = getActionGroupDescription(currentActionGroup);
        }
      }
      
      // Flush the last group
      if (currentActionGroup.length > 0) {
        flushActionGroup(currentActionGroup, groupDescription);
      }
    }
  }

  // Helper function to flush action group
  function flushActionGroup(actions, description) {
    if (actions.length === 0) return;
    
    code += `  await test.step(${JSON.stringify(description)}, async () => {\n`;
    
    for (const action of actions) {
      const framePrefix = generateFramePrefix(action.framePath);
      let selectorObj = action.selector || { type: 'css', value: action.selector };
      
      // Prioritize unique ID over getByTestId
      if (action.selector && action.selector.type === 'getByTestId') {
        if (action.elementId && action.elementId.trim()) {
          selectorObj = { type: 'id', value: `#${action.elementId}` };
        }
      }
      
      let line = '';
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
          // Only add .locator('button[type="submit"]') if this is actually a form element
          if (action.tagName === 'form') {
            line = `    await ${playwrightLocatorCode(selectorObj, framePrefix)}.locator('button[type=\"submit\"]').click({ force: true });\n`;
          } else {
            // For regular buttons that are classified as submit, treat them as click
            line = `    await ${playwrightLocatorCode(selectorObj, framePrefix)}.click({ force: true });\n`;
          }
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
      }
      code += line;
    }
    
    code += `  });\n\n`;
  }

  // Helper function to get action group description
  function getActionGroupDescription(actions) {
    if (actions.length === 0) return '';
    
    const firstAction = actions[0];
    const lastAction = actions[actions.length - 1];
    
    // Special handling for search flows
    if (actions.some(a => a.type === 'type' && a.value && a.value.toLowerCase().includes('search'))) {
      return 'Search for content';
    }
    
    // Special handling for form submissions
    if (actions.some(a => a.type === 'submit')) {
      return 'Submit form';
    }
    
    // Special handling for typing sequences
    if (actions.every(a => a.type === 'type' || a.type === 'keypress')) {
      return `Type in ${firstAction.selector?.value || firstAction.selector}`;
    }
    
    // Default descriptions
    switch (firstAction.type) {
      case 'click':
        return `Click on ${firstAction.selector?.value || firstAction.selector}`;
      case 'type':
        return `Type in ${firstAction.selector?.value || firstAction.selector}`;
      case 'select':
        return `Select option in ${firstAction.selector?.value || firstAction.selector}`;
      case 'check':
        return `Check ${firstAction.selector?.value || firstAction.selector}`;
      case 'upload':
        return `Upload file to ${firstAction.selector?.value || firstAction.selector}`;
      default:
        return `${firstAction.type} on ${firstAction.selector?.value || firstAction.selector}`;
    }
  }

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

function generateTraditionalTypeScriptCode(actions) {
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

function generateTraditionalPythonCode(actions) {
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

function generateTraditionalJavaCode(actions) {
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