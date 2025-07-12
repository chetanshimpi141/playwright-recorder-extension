// Debug script for Playwright Recorder Extension
// Run this in the browser console to test extension functionality

console.log('=== PLAYWRIGHT RECORDER DEBUG SCRIPT ===');

// Test 1: Check if extension is loaded
function testExtensionLoaded() {
    console.log('Test 1: Checking if extension is loaded...');
    
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        console.log('✅ Chrome extension API available');
        console.log('Extension ID:', chrome.runtime.id);
        return true;
    } else {
        console.log('❌ Chrome extension API not available');
        return false;
    }
}

// Test 2: Test communication with background script
function testBackgroundCommunication() {
    console.log('Test 2: Testing background script communication...');
    
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('❌ Background communication failed:', chrome.runtime.lastError);
                resolve(false);
            } else {
                console.log('✅ Background communication successful:', response);
                resolve(true);
            }
        });
    });
}

// Test 3: Test recording status
function testRecordingStatus() {
    console.log('Test 3: Testing recording status...');
    
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getRecordingStatus' }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('❌ Recording status check failed:', chrome.runtime.lastError);
                resolve(false);
            } else {
                console.log('✅ Recording status:', response);
                resolve(true);
            }
        });
    });
}

// Test 4: Test start recording
function testStartRecording() {
    console.log('Test 4: Testing start recording...');
    
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({
            action: 'startRecording',
            fileName: 'debug-test',
            language: 'javascript'
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('❌ Start recording failed:', chrome.runtime.lastError);
                resolve(false);
            } else {
                console.log('✅ Start recording response:', response);
                resolve(true);
            }
        });
    });
}

// Test 5: Test content script communication
function testContentScriptCommunication() {
    console.log('Test 5: Testing content script communication...');
    
    return new Promise((resolve) => {
        // Try to send a message to content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'ping' }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log('❌ Content script communication failed:', chrome.runtime.lastError);
                        resolve(false);
                    } else {
                        console.log('✅ Content script communication successful:', response);
                        resolve(true);
                    }
                });
            } else {
                console.log('❌ No active tab found');
                resolve(false);
            }
        });
    });
}

// Test 6: Check extension permissions
function testPermissions() {
    console.log('Test 6: Checking extension permissions...');
    
    const requiredPermissions = [
        'activeTab',
        'storage',
        'downloads',
        'scripting'
    ];
    
    chrome.permissions.getAll((permissions) => {
        console.log('Current permissions:', permissions);
        
        const missingPermissions = requiredPermissions.filter(perm => 
            !permissions.permissions.includes(perm)
        );
        
        if (missingPermissions.length > 0) {
            console.log('❌ Missing permissions:', missingPermissions);
        } else {
            console.log('✅ All required permissions present');
        }
    });
}

// Test 7: Check storage access
function testStorageAccess() {
    console.log('Test 7: Testing storage access...');
    
    return new Promise((resolve) => {
        chrome.storage.local.get(['isRecording', 'actionCount'], (result) => {
            if (chrome.runtime.lastError) {
                console.log('❌ Storage access failed:', chrome.runtime.lastError);
                resolve(false);
            } else {
                console.log('✅ Storage access successful:', result);
                resolve(true);
            }
        });
    });
}

// Test 8: Check if content script is injected
function testContentScriptInjection() {
    console.log('Test 8: Testing content script injection...');
    
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: () => {
                        // Check if content script variables are available
                        return {
                            hasContentScript: typeof window.isRecording !== 'undefined',
                            isRecording: window.isRecording || false,
                            hasExtension: typeof chrome !== 'undefined' && chrome.runtime
                        };
                    }
                }, (results) => {
                    if (chrome.runtime.lastError) {
                        console.log('❌ Content script injection test failed:', chrome.runtime.lastError);
                        resolve(false);
                    } else {
                        console.log('✅ Content script injection test:', results[0].result);
                        resolve(true);
                    }
                });
            } else {
                console.log('❌ No active tab for injection test');
                resolve(false);
            }
        });
    });
}

// Run all tests
async function runAllTests() {
    console.log('=== RUNNING ALL DEBUG TESTS ===');
    
    const tests = [
        { name: 'Extension Loaded', fn: testExtensionLoaded },
        { name: 'Background Communication', fn: testBackgroundCommunication },
        { name: 'Recording Status', fn: testRecordingStatus },
        { name: 'Start Recording', fn: testStartRecording },
        { name: 'Content Script Communication', fn: testContentScriptCommunication },
        { name: 'Storage Access', fn: testStorageAccess },
        { name: 'Content Script Injection', fn: testContentScriptInjection }
    ];
    
    const results = [];
    
    for (const test of tests) {
        console.log(`\n--- Running ${test.name} ---`);
        try {
            const result = await test.fn();
            results.push({ name: test.name, success: result });
        } catch (error) {
            console.log(`❌ ${test.name} failed with error:`, error);
            results.push({ name: test.name, success: false, error: error.message });
        }
    }
    
    // Test permissions separately (not async)
    console.log('\n--- Running Permissions Check ---');
    testPermissions();
    
    // Summary
    console.log('\n=== TEST SUMMARY ===');
    results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${result.name}`);
        if (result.error) {
            console.log(`   Error: ${result.error}`);
        }
    });
    
    const passedTests = results.filter(r => r.success).length;
    const totalTests = results.length;
    console.log(`\nOverall: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! Extension should be working correctly.');
    } else {
        console.log('⚠️ Some tests failed. Check the errors above for troubleshooting.');
    }
    
    return results;
}

// Export functions for manual testing
window.debugExtension = {
    runAllTests,
    testExtensionLoaded,
    testBackgroundCommunication,
    testRecordingStatus,
    testStartRecording,
    testContentScriptCommunication,
    testStorageAccess,
    testContentScriptInjection,
    testPermissions
};

console.log('Debug functions available as window.debugExtension');
console.log('Run: debugExtension.runAllTests() to test everything'); 