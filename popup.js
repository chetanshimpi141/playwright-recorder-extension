document.addEventListener('DOMContentLoaded', function() {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusText = document.getElementById('statusText');
  const stats = document.getElementById('stats');
  const status = document.getElementById('status');
  const filename = document.getElementById('filename');
  const language = document.getElementById('language');

  // On popup open, always check and update UI with current recording status
  function refreshPopupState() {
    chrome.runtime.sendMessage({ action: 'getRecordingStatus' }, (response) => {
      if (response && response.isRecording !== undefined) {
        updateUI(response.isRecording, response.actionCount || 0);
        if (response.fileName) filename.value = response.fileName;
        if (response.language) language.value = response.language;
      } else {
        updateUI(false, 0);
      }
    });
  }
  // Call on load
  refreshPopupState();

  startBtn.addEventListener('click', function() {
    console.log('=== POPUP: START BUTTON CLICKED ===');
    const fileName = filename.value.trim() || 'recorded-test';
    const selectedLanguage = language.value;
    
    console.log('Popup sending request:', { action: 'startRecording', fileName, language: selectedLanguage });
    
    chrome.runtime.sendMessage({
      action: 'startRecording',
      fileName: fileName,
      language: selectedLanguage
    }, function(response) {
      console.log('Popup received response:', response);
      if (chrome.runtime.lastError) {
        console.error('Popup runtime error:', chrome.runtime.lastError);
        alert('Failed to start recording: ' + chrome.runtime.lastError.message);
        return;
      }
      
      if (response && response.success) {
        console.log('Recording started successfully from popup');
        updateUI(true, 0);
        // Close popup after starting
        window.close();
      } else {
        console.error('Failed to start recording:', response);
        alert('Failed to start recording: ' + (response ? response.error : 'Unknown error'));
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
      status.textContent = 'Recording...';
      status.classList.add('recording');
      filename.disabled = true;
      language.disabled = true;
    } else {
      startBtn.disabled = false;
      stopBtn.disabled = true;
      status.textContent = 'Ready to record';
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
    const codePreviewElem = document.getElementById('codePreview');
    codePreviewElem.innerHTML = highlightCode(previewCode);
    
    // Show preview section
    document.getElementById('previewSection').style.display = 'block';
    
    // Update stats
    stats.textContent = `Actions recorded: ${actionCount}`;
    
    // Hide AI summary by default (can be set by backend in future)
    const aiSummaryElem = document.getElementById('aiSummary');
    aiSummaryElem.style.display = 'none';
    aiSummaryElem.textContent = '';
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

  // Syntax highlighting for code preview (basic, language-agnostic)
  function highlightCode(code) {
    // Simple keyword-based highlighting for JS/Python/TS/Java
    const keywords = [
      'import', 'from', 'async', 'await', 'function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'new', 'class', 'try', 'catch', 'finally', 'throw', 'public', 'private', 'protected', 'static', 'void', 'int', 'float', 'double', 'boolean', 'String', 'def', 'with', 'as', 'lambda', 'None', 'True', 'False', 'null', 'package', 'extends', 'implements', 'interface', 'super', 'this'
    ];
    const keywordRegex = new RegExp('\\b(' + keywords.join('|') + ')\\b', 'g');
    return code
      .replace(/(\".*?\"|\'.*?\')/g, '<span style="color:#e6db74;">$1</span>') // strings
      .replace(/(\/\/.*|#.*)/g, '<span style="color:#6a9955;">$1</span>') // comments
      .replace(keywordRegex, '<span style="color:#4f8cff;">$1</span>');
  }

  // Copy to clipboard functionality
  document.getElementById('copyCodeBtn').addEventListener('click', function() {
    const code = document.getElementById('codePreview').innerText;
    navigator.clipboard.writeText(code).then(() => {
      this.textContent = '✅ Copied!';
      setTimeout(() => { this.textContent = '📋 Copy'; }, 1500);
    });
  });
  
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

  // Feedback/Report Button Logic
  const feedbackBtn = document.getElementById('feedbackBtn');
  const feedbackModal = document.getElementById('feedbackModal');
  const closeFeedbackModal = document.getElementById('closeFeedbackModal');
  const sendFeedbackBtn = document.getElementById('sendFeedbackBtn');
  const cancelFeedbackBtn = document.getElementById('cancelFeedbackBtn');
  const feedbackText = document.getElementById('feedbackText');
  const feedbackStatus = document.getElementById('feedbackStatus');

  feedbackBtn.addEventListener('click', function() {
    feedbackModal.style.display = 'flex';
    feedbackText.value = '';
    feedbackStatus.style.display = 'none';
    feedbackStatus.textContent = '';
  });
  closeFeedbackModal.addEventListener('click', function() {
    feedbackModal.style.display = 'none';
  });
  cancelFeedbackBtn.addEventListener('click', function() {
    feedbackModal.style.display = 'none';
  });
  sendFeedbackBtn.addEventListener('click', function() {
    const text = feedbackText.value.trim();
    if (!text) {
      feedbackStatus.style.display = 'block';
      feedbackStatus.style.color = '#e74c3c';
      feedbackStatus.textContent = 'Please enter your feedback or issue.';
      return;
    }
    // For now, just log feedback. In production, send to a backend or email.
    console.log('User Feedback:', text);
    feedbackStatus.style.display = 'block';
    feedbackStatus.style.color = '#27ae60';
    feedbackStatus.textContent = 'Thank you for your feedback!';
    setTimeout(() => { feedbackModal.style.display = 'none'; }, 1500);
  });

  // Show clear error messages for AI failures in code preview (if needed)
  // (Assume future backend will set aiSummaryElem.textContent and display)

  // Language tips for each language
  const languageTips = {
    javascript: 'Tip: Use Playwright test runner for best results.',
    typescript: 'Tip: TypeScript support requires type definitions.',
    python: 'Tip: Use pytest or unittest for running Playwright Python tests.',
    java: 'Tip: Use JUnit/TestNG for Java Playwright tests.'
  };
  const languageTipElem = document.createElement('div');
  languageTipElem.id = 'languageTip';
  languageTipElem.style = 'margin-top:4px;color:#b0b3b8;font-size:13px;';
  language.parentNode.appendChild(languageTipElem);

  // Restore last used language from storage
  chrome.storage.local.get(['lastLanguage'], function(result) {
    if (result.lastLanguage) {
      language.value = result.lastLanguage;
      languageTipElem.textContent = languageTips[result.lastLanguage] || '';
    } else {
      languageTipElem.textContent = languageTips[language.value] || '';
    }
  });

  // Save language selection and show tip
  language.addEventListener('change', function() {
    chrome.storage.local.set({ lastLanguage: language.value });
    languageTipElem.textContent = languageTips[language.value] || '';
  });

  // Export/Import Recording Logic
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFileInput = document.getElementById('importFileInput');

  exportBtn.addEventListener('click', function() {
    if (!currentActions || currentActions.length === 0) {
      alert('No actions to export.');
      return;
    }
    const dataStr = JSON.stringify(currentActions, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (filename.value.trim() || 'recorded-test') + '-recording.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  });

  importBtn.addEventListener('click', function() {
    importFileInput.value = '';
    importFileInput.click();
  });

  importFileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const imported = JSON.parse(evt.target.result);
        if (!Array.isArray(imported) || imported.length === 0) throw new Error('Invalid recording file.');
        currentActions = imported;
        editedActions = [...currentActions];
        showScriptPreview(currentActions, currentActions.length);
        alert('Recording imported successfully!');
      } catch (err) {
        alert('Failed to import recording: ' + err.message);
      }
    };
    reader.readAsText(file);
  });
}); 