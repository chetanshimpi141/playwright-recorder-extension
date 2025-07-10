document.addEventListener('DOMContentLoaded', function() {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusText = document.getElementById('statusText');
  const stats = document.getElementById('stats');
  const status = document.getElementById('status');
  const filename = document.getElementById('filename');
  const language = document.getElementById('language');

  // Check current recording status
  chrome.storage.local.get(['isRecording', 'actionCount', 'currentFileName', 'currentLanguage'], function(result) {
    updateUI(result.isRecording || false, result.actionCount || 0);
    
    // Restore previous values if recording was in progress
    if (result.isRecording) {
      if (result.currentFileName) {
        filename.value = result.currentFileName;
      }
      if (result.currentLanguage) {
        language.value = result.currentLanguage;
      }
    }
  });

  startBtn.addEventListener('click', function() {
    const fileName = filename.value.trim() || 'recorded-test';
    const selectedLanguage = language.value;
    
    chrome.runtime.sendMessage({
      action: 'startRecording',
      fileName: fileName,
      language: selectedLanguage
    }, function(response) {
      if (response.success) {
        updateUI(true, 0);
        // Close popup after starting
        window.close();
      } else {
        alert('Failed to start recording: ' + response.error);
      }
    });
  });

  stopBtn.addEventListener('click', function() {
    chrome.runtime.sendMessage({
      action: 'stopRecording'
    }, function(response) {
      if (response.success) {
        updateUI(false, 0);
        showScriptPreview(response.actions, response.actionCount);
      } else {
        alert('Failed to stop recording: ' + response.error);
      }
    });
  });

  function updateUI(isRecording, actionCount) {
    if (isRecording) {
      startBtn.disabled = true;
      stopBtn.disabled = false;
      statusText.textContent = 'Recording...';
      status.classList.add('recording');
      filename.disabled = true;
      language.disabled = true;
    } else {
      startBtn.disabled = false;
      stopBtn.disabled = true;
      statusText.textContent = 'Ready to record';
      status.classList.remove('recording');
      filename.disabled = false;
      language.disabled = false;
    }
    stats.textContent = `Actions recorded: ${actionCount}`;
  }

  // Listen for updates from background script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'updateStats') {
      stats.textContent = `Actions recorded: ${request.actionCount}`;
    }
  });
  
  // Periodically check recording status to keep UI in sync
  setInterval(() => {
    chrome.runtime.sendMessage({ action: 'getRecordingStatus' }, (response) => {
      if (response && response.isRecording !== undefined) {
        updateUI(response.isRecording, response.actionCount || 0);
      }
    });
  }, 2000); // Check every 2 seconds
  
  // Script Preview and Editing Functionality
  let currentActions = [];
  let editedActions = [];
  
  function showScriptPreview(actions, actionCount) {
    currentActions = actions || [];
    editedActions = [...currentActions];
    
    // Generate preview code
    const previewCode = generatePreviewCode(editedActions);
    document.getElementById('codePreview').textContent = previewCode;
    
    // Show preview section
    document.getElementById('previewSection').style.display = 'block';
    
    // Update stats
    stats.textContent = `Actions recorded: ${actionCount}`;
  }
  
  function generatePreviewCode(actions) {
    const language = document.getElementById('language').value;
    const fileName = document.getElementById('filename').value.trim() || 'recorded-test';
    
    // This is a simplified preview - the full code generation is in background.js
    let code = `// Preview of generated ${language} code\n`;
    code += `// File: ${fileName}.spec.js\n\n`;
    
    actions.forEach((action, index) => {
      code += `// Step ${index + 1}: ${action.type}\n`;
      code += `// Selector: ${action.selector}\n`;
      if (action.value) {
        code += `// Value: ${action.value}\n`;
      }
      code += '\n';
    });
    
    return code;
  }
  
  // Edit button functionality
  document.getElementById('editBtn').addEventListener('click', function() {
    showEditModal();
  });
  
  // Download button functionality
  document.getElementById('downloadBtn').addEventListener('click', function() {
    downloadScript();
  });
  
  // Close preview button
  document.getElementById('closePreviewBtn').addEventListener('click', function() {
    document.getElementById('previewSection').style.display = 'none';
  });
  
  function showEditModal() {
    const stepsList = document.getElementById('stepsList');
    stepsList.innerHTML = '';
    
    editedActions.forEach((action, index) => {
      const stepItem = createStepItem(action, index);
      stepsList.appendChild(stepItem);
    });
    
    document.getElementById('editModal').style.display = 'flex';
  }
  
  function createStepItem(action, index) {
    const stepDiv = document.createElement('div');
    stepDiv.className = 'step-item';
    
    const stepHeader = document.createElement('div');
    stepHeader.className = 'step-header';
    
    const stepType = document.createElement('span');
    stepType.className = 'step-type';
    stepType.textContent = action.type;
    
    const stepActions = document.createElement('div');
    stepActions.className = 'step-actions';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'step-btn delete';
    deleteBtn.textContent = '🗑️';
    deleteBtn.onclick = () => deleteStep(index);
    
    const moveUpBtn = document.createElement('button');
    moveUpBtn.className = 'step-btn';
    moveUpBtn.textContent = '⬆️';
    moveUpBtn.onclick = () => moveStep(index, -1);
    moveUpBtn.disabled = index === 0;
    
    const moveDownBtn = document.createElement('button');
    moveDownBtn.className = 'step-btn';
    moveDownBtn.textContent = '⬇️';
    moveDownBtn.onclick = () => moveStep(index, 1);
    moveDownBtn.disabled = index === editedActions.length - 1;
    
    stepActions.appendChild(moveUpBtn);
    stepActions.appendChild(moveDownBtn);
    stepActions.appendChild(deleteBtn);
    
    stepHeader.appendChild(stepType);
    stepHeader.appendChild(stepActions);
    
    const stepDetails = document.createElement('div');
    stepDetails.className = 'step-details';
    
    const selectorDiv = document.createElement('div');
    selectorDiv.className = 'step-selector';
    selectorDiv.textContent = action.selector;
    
    stepDetails.appendChild(selectorDiv);
    
    if (action.text) {
      const textDiv = document.createElement('div');
      textDiv.textContent = `Text: ${action.text}`;
      stepDetails.appendChild(textDiv);
    }
    
    if (action.value !== undefined && action.value !== null) {
      const valueDiv = document.createElement('div');
      valueDiv.textContent = `Value: ${action.value}`;
      stepDetails.appendChild(valueDiv);
    }
    
    stepDiv.appendChild(stepHeader);
    stepDiv.appendChild(stepDetails);
    
    return stepDiv;
  }
  
  function deleteStep(index) {
    editedActions.splice(index, 1);
    updateEditModal();
  }
  
  function moveStep(index, direction) {
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < editedActions.length) {
      const temp = editedActions[index];
      editedActions[index] = editedActions[newIndex];
      editedActions[newIndex] = temp;
      updateEditModal();
    }
  }
  
  function updateEditModal() {
    const stepsList = document.getElementById('stepsList');
    stepsList.innerHTML = '';
    
    editedActions.forEach((action, index) => {
      const stepItem = createStepItem(action, index);
      stepsList.appendChild(stepItem);
    });
    
    // Update preview
    const previewCode = generatePreviewCode(editedActions);
    document.getElementById('codePreview').textContent = previewCode;
  }
  
  // Modal close functionality
  document.getElementById('closeModalBtn').addEventListener('click', function() {
    document.getElementById('editModal').style.display = 'none';
  });
  
  document.getElementById('cancelChangesBtn').addEventListener('click', function() {
    editedActions = [...currentActions];
    document.getElementById('editModal').style.display = 'none';
    updateEditModal();
  });
  
  document.getElementById('saveChangesBtn').addEventListener('click', function() {
    currentActions = [...editedActions];
    document.getElementById('editModal').style.display = 'none';
    updateEditModal();
  });
  
  function downloadScript() {
    const fileName = document.getElementById('filename').value.trim() || 'recorded-test';
    const language = document.getElementById('language').value;
    
    chrome.runtime.sendMessage({
      action: 'generateScript',
      actions: editedActions,
      fileName: fileName,
      language: language
    }, function(response) {
      if (response.success) {
        alert(`Script downloaded successfully!\nFile: ${response.fileName}`);
      } else {
        alert('Failed to download script: ' + response.error);
      }
    });
  }
}); 