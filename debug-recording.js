// Debug script for Playwright Recorder Extension
// Add this to the browser console to debug recording issues

console.log('=== Playwright Recorder Debug Script ===');

// Function to check recording status
function checkRecordingStatus() {
  chrome.runtime.sendMessage({ action: 'getRecordingStatus' }, (response) => {
    console.log('Recording Status:', response);
    if (chrome.runtime.lastError) {
      console.error('Error getting status:', chrome.runtime.lastError);
    }
  });
}

// Function to force reconnect
function forceReconnect() {
  chrome.runtime.sendMessage({ action: 'forceReconnect' }, (response) => {
    console.log('Force reconnect response:', response);
    if (chrome.runtime.lastError) {
      console.error('Error forcing reconnect:', chrome.runtime.lastError);
    }
  });
}

// Function to check storage
function checkStorage() {
  chrome.storage.local.get(null, (result) => {
    console.log('Storage contents:', result);
  });
}

// Function to simulate user interaction
function simulateInteraction() {
  console.log('Simulating user interaction...');
  const event = new MouseEvent('click', {
    view: window,
    bubbles: true,
    cancelable: true,
    clientX: 100,
    clientY: 100
  });
  document.body.dispatchEvent(event);
}

// Add debug functions to window
window.playwrightDebug = {
  checkStatus: checkRecordingStatus,
  forceReconnect: forceReconnect,
  checkStorage: checkStorage,
  simulateInteraction: simulateInteraction
};

console.log('Debug functions available:');
console.log('- window.playwrightDebug.checkStatus() - Check recording status');
console.log('- window.playwrightDebug.forceReconnect() - Force reconnect');
console.log('- window.playwrightDebug.checkStorage() - Check storage');
console.log('- window.playwrightDebug.simulateInteraction() - Simulate interaction');

// Auto-check status every 2 seconds
setInterval(() => {
  checkRecordingStatus();
}, 2000);

console.log('Auto-checking recording status every 2 seconds...'); 