// Extension Reload Helper
// This script helps reload the Playwright Recorder extension

console.log('=== EXTENSION RELOAD HELPER ===');

// Function to reload the extension
function reloadExtension() {
    console.log('Reloading Playwright Recorder extension...');
    
    // Get the extension ID
    const extensionId = chrome.runtime.id;
    console.log('Extension ID:', extensionId);
    
    // Navigate to the extension management page
    const managementUrl = `chrome://extensions/?id=${extensionId}`;
    console.log('Opening extension management page:', managementUrl);
    
    // Open the management page in a new tab
    chrome.tabs.create({ url: managementUrl }, (tab) => {
        console.log('Opened extension management tab:', tab.id);
        
        // Wait a moment for the page to load, then reload the extension
        setTimeout(() => {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    // Find and click the reload button
                    const reloadButton = document.querySelector(`[data-extension-id="${chrome.runtime.id}"] .reload-button`);
                    if (reloadButton) {
                        reloadButton.click();
                        return 'Extension reloaded successfully';
                    } else {
                        return 'Could not find reload button';
                    }
                }
            }, (results) => {
                if (results && results[0]) {
                    console.log('Reload result:', results[0].result);
                }
                
                // Close the management tab after a delay
                setTimeout(() => {
                    chrome.tabs.remove(tab.id);
                    console.log('Closed extension management tab');
                }, 2000);
            });
        }, 1000);
    });
}

// Function to check if extension needs reloading
function checkExtensionStatus() {
    console.log('Checking extension status...');
    
    // Test basic functionality
    chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
        if (chrome.runtime.lastError) {
            console.log('❌ Extension needs reloading:', chrome.runtime.lastError);
            console.log('Run: reloadExtension() to reload the extension');
        } else {
            console.log('✅ Extension is working correctly');
        }
    });
}

// Function to force reload all content scripts
function reloadContentScripts() {
    console.log('Reloading content scripts...');
    
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
                console.log('Reloading content script in tab:', tab.id, tab.url);
                
                // Remove existing content script
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        // Clean up any existing content script state
                        if (window.isRecording !== undefined) {
                            window.isRecording = false;
                        }
                        return 'Content script state cleared';
                    }
                });
                
                // Inject fresh content script
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                }, () => {
                    console.log('Content script reloaded in tab:', tab.id);
                });
            }
        });
    });
}

// Function to clear extension storage
function clearExtensionStorage() {
    console.log('Clearing extension storage...');
    
    chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
            console.log('❌ Failed to clear storage:', chrome.runtime.lastError);
        } else {
            console.log('✅ Extension storage cleared');
        }
    });
}

// Function to reset extension state
function resetExtension() {
    console.log('Resetting extension state...');
    
    // Clear storage
    clearExtensionStorage();
    
    // Reload content scripts
    reloadContentScripts();
    
    // Check status after reset
    setTimeout(() => {
        checkExtensionStatus();
    }, 1000);
}

// Export functions
window.extensionReloader = {
    reloadExtension,
    checkExtensionStatus,
    reloadContentScripts,
    clearExtensionStorage,
    resetExtension
};

console.log('Extension reload functions available as window.extensionReloader');
console.log('Available functions:');
console.log('- extensionReloader.checkExtensionStatus()');
console.log('- extensionReloader.reloadExtension()');
console.log('- extensionReloader.reloadContentScripts()');
console.log('- extensionReloader.clearExtensionStorage()');
console.log('- extensionReloader.resetExtension()');

// Auto-check status
checkExtensionStatus(); 