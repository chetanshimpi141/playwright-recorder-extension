// Error Recovery Script for Playwright Recorder Extension
// This script helps recover from "Extension context invalidated" errors

console.log('=== Playwright Recorder Error Recovery ===');

// Function to check if extension context is valid
function isExtensionContextValid() {
  try {
    return chrome && chrome.runtime && chrome.runtime.id;
  } catch (error) {
    return false;
  }
}

// Function to safely send message to extension
function safeSendMessage(message, callback) {
  if (!isExtensionContextValid()) {
    console.warn('Extension context invalid, cannot send message');
    if (callback) callback({ error: 'Extension context invalid' });
    return;
  }
  
  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('Message failed:', chrome.runtime.lastError);
        if (callback) callback({ error: chrome.runtime.lastError.message });
      } else {
        if (callback) callback(response);
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    if (callback) callback({ error: error.message });
  }
}

// Function to recover from context invalidation
function recoverFromContextInvalidation() {
  console.log('Attempting to recover from context invalidation...');
  
  // Clear any existing recording state
  localStorage.removeItem('playwright-recorder-state');
  
  // Try to reload the page to get a fresh extension context
  console.log('Reloading page to get fresh extension context...');
  window.location.reload();
}

// Function to check recording status safely
function checkRecordingStatus() {
  safeSendMessage({ action: 'getRecordingStatus' }, (response) => {
    if (response.error) {
      console.error('Failed to check recording status:', response.error);
      if (response.error.includes('Extension context invalidated')) {
        recoverFromContextInvalidation();
      }
    } else {
      console.log('Recording status:', response);
    }
  });
}

// Function to start recording safely
function startRecording(fileName = 'test', language = 'javascript') {
  safeSendMessage({
    action: 'startRecording',
    fileName: fileName,
    language: language
  }, (response) => {
    if (response.error) {
      console.error('Failed to start recording:', response.error);
      if (response.error.includes('Extension context invalidated')) {
        recoverFromContextInvalidation();
      }
    } else {
      console.log('Recording started successfully');
    }
  });
}

// Function to stop recording safely
function stopRecording() {
  safeSendMessage({ action: 'stopRecording' }, (response) => {
    if (response.error) {
      console.error('Failed to stop recording:', response.error);
    } else {
      console.log('Recording stopped successfully');
    }
  });
}

// Monitor for extension context errors
window.addEventListener('error', (event) => {
  if (event.error && event.error.message && event.error.message.includes('Extension context invalidated')) {
    console.warn('Extension context invalidation detected');
    recoverFromContextInvalidation();
  }
});

// Add recovery functions to window
window.playwrightRecovery = {
  checkStatus: checkRecordingStatus,
  startRecording: startRecording,
  stopRecording: stopRecording,
  isContextValid: isExtensionContextValid,
  recover: recoverFromContextInvalidation
};

console.log('Error recovery functions available:');
console.log('- window.playwrightRecovery.checkStatus() - Check recording status safely');
console.log('- window.playwrightRecovery.startRecording() - Start recording safely');
console.log('- window.playwrightRecovery.stopRecording() - Stop recording safely');
console.log('- window.playwrightRecovery.isContextValid() - Check if extension context is valid');
console.log('- window.playwrightRecovery.recover() - Attempt to recover from context invalidation');

// Auto-check context validity every 5 seconds
setInterval(() => {
  if (!isExtensionContextValid()) {
    console.warn('Extension context lost, attempting recovery...');
    recoverFromContextInvalidation();
  }
}, 5000);

console.log('Error recovery script loaded successfully!'); 