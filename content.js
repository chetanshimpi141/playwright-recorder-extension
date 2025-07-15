let isRecording = false;
let currentUrl = window.location.href;
let frameContexts = new Map(); // Track frame contexts
let currentFrame = null; // Current frame context
let reconnectAttempts = 0;
let maxReconnectAttempts = 10; // Increased max attempts
let statusCheckInterval = null;
let lastStatusCheck = 0;
let recordingIndicator = null;
let isInitialized = false;
let connectionRetryInterval = null;
let lastSuccessfulConnection = 0;
let forceReconnectInterval = null;

// Enhanced selector generator for robust Playwright locators
function generateSelector(element) {
  // 1. getByTestId
  const testIdAttrs = ['data-testid', 'data-test', 'data-qa', 'data-cy'];
  for (const attr of testIdAttrs) {
    const value = element.getAttribute(attr);
    if (value && value.trim()) {
      return { type: 'getByTestId', value, attr };
    }
  }

  // 2. getByRole (with accessible name)
  if (element.getAttribute) {
    const role = element.getAttribute('role');
    let name = '';
    if (element.ariaLabel) name = element.ariaLabel;
    else if (element.getAttribute('aria-label')) name = element.getAttribute('aria-label');
    else if (element.textContent && element.textContent.trim().length < 50) name = element.textContent.trim();
    if (role && name) {
      return { type: 'getByRole', value: role, name };
    }
  }

  // 3. getByLabel (for form fields)
  if (element.labels && element.labels.length > 0) {
    const label = element.labels[0].textContent.trim();
    if (label) {
      return { type: 'getByLabel', value: label };
    }
  }

  // 4. getByPlaceholder
  if (element.placeholder && element.placeholder.trim()) {
    return { type: 'getByPlaceholder', value: element.placeholder };
  }

  // 5. getByAltText (for images)
  if (element.tagName === 'IMG' && element.alt && element.alt.trim()) {
    return { type: 'getByAltText', value: element.alt };
  }

  // 6. getByTitle
  if (element.title && element.title.trim()) {
    return { type: 'getByTitle', value: element.title };
  }

  // 7. Unique ID
  if (element.id && element.id.trim() && document.querySelectorAll(`#${CSS.escape(element.id)}`).length === 1) {
    return { type: 'id', value: `#${element.id}` };
  }

  // 8. Name attribute (for form fields)
  if (element.name && element.name.trim()) {
    return { type: 'name', value: element.name };
  }

  // 9. Fallback: class, attributes, nth-child
  if (element.className && typeof element.className === 'string') {
    const classValue = element.className.trim().replace(/\s+/g, ' ');
    if (classValue) {
      return { type: 'class-attr', value: `[class=\"${classValue}\"]` };
    }
  }

  // Fallback: path-based selector
  return { type: 'css', value: generatePathSelector(element) };
}

// Enhanced path-based selector generation
function generatePathSelector(element) {
  let path = [];
  let current = element;
  let maxDepth = 5; // Limit depth to avoid overly long selectors
  
  while (current && current !== document.body && maxDepth > 0) {
    let selector = current.tagName.toLowerCase();
    
    // Add ID if available
    if (current.id && current.id.trim()) {
      selector = `#${current.id}`;
      path.unshift(selector);
      break;
    }
    
    // Add classes (limited to 2 most specific)
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.split(' ')
        .filter(c => c.trim() && !c.startsWith('js-') && !c.startsWith('ng-'))
        .slice(0, 2);
      if (classes.length > 0) {
        selector += `.${classes.join('.')}`;
      }
    }
    
    // Add nth-child for siblings
    const siblings = Array.from(current.parentNode.children).filter(child => 
      child.tagName === current.tagName
    );
    if (siblings.length > 1) {
      const index = siblings.indexOf(current) + 1;
      selector += `:nth-child(${index})`;
    }
    
    path.unshift(selector);
    current = current.parentNode;
    maxDepth--;
  }
  
  return path.join(' > ');
}

// Function to get element value based on type
function getElementValue(element) {
  const tagName = element.tagName.toLowerCase();
  const type = element.type ? element.type.toLowerCase() : '';
  
  switch (tagName) {
    case 'input':
      switch (type) {
        case 'checkbox':
          return element.checked;
        case 'radio':
          return element.checked ? element.value : null;
        case 'file':
          return element.files ? Array.from(element.files).map(f => f.name).join(', ') : '';
        default:
          return element.value;
      }
    case 'select':
      if (element.multiple) {
        return Array.from(element.selectedOptions).map(option => option.value);
      } else {
        return element.value;
      }
    case 'textarea':
      return element.value;
    default:
      return element.textContent?.trim() || '';
  }
}

// Frame handling functions
function getFrameContext(element) {
  let frame = null;
  let framePath = [];
  let current = element;
  
  // Walk up the DOM tree to find frames
  while (current && current !== document) {
    if (current.tagName === 'IFRAME') {
      framePath.unshift({
        type: 'iframe',
        selector: generateFrameSelector(current),
        index: getFrameIndex(current)
      });
      frame = current;
    } else if (current.getRootNode && current.getRootNode().host) {
      // Shadow DOM
      framePath.unshift({
        type: 'shadow',
        selector: generateShadowSelector(current.getRootNode().host),
        index: getFrameIndex(current.getRootNode().host)
      });
      frame = current.getRootNode().host;
    }
    current = current.parentNode || current.parentElement;
  }
  
  return {
    frame: frame,
    path: framePath,
    context: frame ? frame.contentDocument || frame.contentWindow?.document : document
  };
}

function generateFrameSelector(frame) {
  if (frame.id) {
    return `#${frame.id}`;
  }
  
  if (frame.name) {
    return `iframe[name="${frame.name}"]`;
  }
  
  if (frame.src) {
    return `iframe[src*="${frame.src.split('/').pop()}"]`;
  }
  
  // Generate path-based selector
  let path = [];
  let current = frame;
  
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    
    if (current.id) {
      selector = `#${current.id}`;
      path.unshift(selector);
      break;
    }
    
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        selector += `.${classes.join('.')}`;
      }
    }
    
    const siblings = Array.from(current.parentNode.children).filter(child => 
      child.tagName === current.tagName
    );
    if (siblings.length > 1) {
      const index = siblings.indexOf(current) + 1;
      selector += `:nth-child(${index})`;
    }
    
    path.unshift(selector);
    current = current.parentNode;
  }
  
  return path.join(' > ');
}

function generateShadowSelector(host) {
  if (host.id) {
    return `#${host.id}`;
  }
  
  if (host.className && typeof host.className === 'string') {
    const classes = host.className.split(' ').filter(c => c.trim());
    if (classes.length > 0) {
      return `.${classes.join('.')}`;
    }
  }
  
  return generatePathSelector(host);
}

function getFrameIndex(frame) {
  const siblings = Array.from(frame.parentNode.children).filter(child => 
    child.tagName === frame.tagName
  );
  return siblings.indexOf(frame);
}

function getFramePathString(framePath) {
  return framePath.map(frame => {
    if (frame.type === 'iframe') {
      return `frameLocator('${frame.selector}')`;
    } else if (frame.type === 'shadow') {
      return `locator('${frame.selector}').shadowRoot`;
    }
  }).join('.');
}

// Function to determine action type based on element and event
function determineActionType(element, event) {
  const tagName = element.tagName.toLowerCase();
  const type = element.type ? element.type.toLowerCase() : '';
  const eventType = event.type;
  
  // Filter out unnecessary events
  if (eventType === 'mouseover' || eventType === 'mouseenter') {
    // Only record hover for interactive elements that might show tooltips/dropdowns
    if (element.hasAttribute('title') || element.hasAttribute('aria-label') || 
        element.classList.contains('dropdown') || element.classList.contains('tooltip')) {
      return 'hover';
    }
    return null; // Skip unnecessary hover events
  }
  
  if (eventType === 'focus' || eventType === 'focusin') {
    // Only record focus for form elements or elements with specific focus behavior
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || 
        element.hasAttribute('tabindex') || element.getAttribute('role') === 'button') {
      return 'focus';
    }
    return null; // Skip unnecessary focus events
  }
  
  if (eventType === 'blur' || eventType === 'focusout') {
    // Only record blur for form elements
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
      return 'blur';
    }
    return null; // Skip unnecessary blur events
  }
  
  // Handle click events
  if (eventType === 'click') {
    // Check for double click
    if (event.detail === 2) {
      return 'doubleClick';
    }
    
    // Check for right click
    if (event.button === 2) {
      return 'rightClick';
    }
    
    // Handle form submissions
    if (tagName === 'form') {
      return 'submit';
    }
    
    // Handle submit buttons (only if they have type="submit")
    if (tagName === 'button' && type === 'submit') {
      return 'submit';
    }
    
    // Handle checkboxes and radio buttons
    if (tagName === 'input' && (type === 'checkbox' || type === 'radio')) {
      return 'check';
    }
    
    // Handle file uploads
    if (tagName === 'input' && type === 'file') {
      return 'upload';
    }
    
    // Handle select dropdowns
    if (tagName === 'select') {
      return 'select';
    }
    
    // Handle links and buttons
    if (tagName === 'a' || tagName === 'button' || element.getAttribute('role') === 'button') {
      return 'click';
    }
    
    // Handle other clickable elements
    if (element.onclick || element.hasAttribute('onclick') || 
        element.style.cursor === 'pointer' || element.classList.contains('clickable')) {
      return 'click';
    }
    
    return 'click';
  }
  
  // Handle input events
  if (eventType === 'input' || eventType === 'change') {
    if (tagName === 'input') {
      if (type === 'checkbox' || type === 'radio') {
        return 'check';
      } else if (type === 'file') {
        return 'upload';
      } else {
        return 'type';
      }
    } else if (tagName === 'textarea') {
      return 'type';
    } else if (tagName === 'select') {
      return 'select';
    }
  }
  
  // Handle keyboard events
  if (eventType === 'keydown' || eventType === 'keyup') {
    // Only record specific keyboard shortcuts and important keys
    const key = event.key.toLowerCase();
    const isCtrl = event.ctrlKey || event.metaKey;
    const isShift = event.shiftKey;
    const isAlt = event.altKey;
    
    // Record copy/paste operations
    if (isCtrl && (key === 'c' || key === 'v' || key === 'x' || key === 'a')) {
      return 'keypress';
    }
    
    // Record Enter key for form submissions
    if (key === 'enter' && (tagName === 'input' || tagName === 'textarea')) {
      return 'keypress';
    }
    
    // Record Escape key
    if (key === 'escape') {
      return 'keypress';
    }
    
    // Record Tab key for navigation
    if (key === 'tab') {
      return 'keypress';
    }
    
    // Record arrow keys for navigation
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      return 'keypress';
    }
    
    // Skip other keyboard events to reduce noise
    return null;
  }
  
  // Handle scroll events (throttled)
  if (eventType === 'scroll') {
    // Only record significant scroll events
    const scrollY = window.scrollY;
    const lastScrollY = window.lastScrollY || 0;
    const scrollDiff = Math.abs(scrollY - lastScrollY);
    
    if (scrollDiff > 100) { // Only record if scrolled more than 100px
      window.lastScrollY = scrollY;
      return 'scroll';
    }
    return null;
  }
  
  return null;
}

// Function to record an action with enhanced logic
function recordAction(actionData) {
  // Check if we should skip this action
  if (shouldSkipAction(actionData)) {
    return;
  }
  
  // Add timestamp and URL
  actionData.timestamp = Date.now();
  actionData.url = window.location.href;
  
  // Get frame context
  const frameContext = getFrameContext(actionData.element || document.activeElement);
  actionData.framePath = frameContext.path;
  
  // Clean up the action data
  cleanActionData(actionData);
  
  console.log('Recording action:', actionData.type, actionData.selector);
  
  // Send to background script
  try {
    chrome.runtime.sendMessage({
      action: 'recordAction',
      actionData: actionData
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('Failed to record action:', chrome.runtime.lastError);
      }
    });
  } catch (error) {
    console.error('Error recording action:', error);
  }
}

// Function to determine if we should skip an action
function shouldSkipAction(actionData) {
  // Skip if not recording
  if (!isRecording) {
    return true;
  }

  // Skip duplicate actions within short time
  const now = Date.now();
  const lastAction = window.lastRecordedAction;
  if (lastAction &&
      lastAction.type === actionData.type &&
      lastAction.selector === actionData.selector &&
      now - lastAction.timestamp < 500) { // Skip duplicates within 500ms
    return true;
  }

  // Skip navigation to same URL
  if (actionData.type === 'navigate') {
    const currentUrl = window.location.href;
    if (window.lastNavigationUrl === currentUrl) {
      return true;
    }
    window.lastNavigationUrl = currentUrl;
  }

  // Skip unnecessary hover events
  if (actionData.type === 'hover') {
    const element = actionData.element;
    if (!element || !element.hasAttribute('title') && !element.hasAttribute('aria-label')) {
      return true;
    }
  }

  // Skip focus/blur on non-form elements
  if ((actionData.type === 'focus' || actionData.type === 'blur') &&
      !['input', 'textarea', 'select'].includes(actionData.element?.tagName?.toLowerCase())) {
    return true;
  }

  // Enhanced: Skip clicks on non-interactive, hidden, or disabled elements
  if (actionData.type === 'click' || actionData.type === 'doubleClick' || actionData.type === 'rightClick') {
    const el = actionData.element;
    if (el) {
      const tag = el.tagName?.toLowerCase();
      const isInteractive = [
        'a', 'button', 'input', 'select', 'textarea'
      ].includes(tag) ||
        el.hasAttribute('role') ||
        el.hasAttribute('tabindex') ||
        getComputedStyle(el).cursor === 'pointer';
      const isHidden = el.offsetParent === null || getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).display === 'none';
      const isDisabled = el.disabled === true || el.getAttribute('aria-disabled') === 'true';
      // Check if element is in viewport
      const rect = el.getBoundingClientRect();
      const inViewport = rect.bottom > 0 && rect.right > 0 && rect.left < (window.innerWidth || document.documentElement.clientWidth) && rect.top < (window.innerHeight || document.documentElement.clientHeight);
      if (!isInteractive || isHidden || isDisabled || !inViewport) {
        return true;
      }
    }
  }

  // Enhanced: Skip insignificant scrolls
  if (actionData.type === 'scroll') {
    if (typeof actionData.scrollY === 'number') {
      if (!window._lastRecordedScrollY) window._lastRecordedScrollY = 0;
      const diff = Math.abs(actionData.scrollY - window._lastRecordedScrollY);
      if (diff < 100) {
        return true;
      }
      window._lastRecordedScrollY = actionData.scrollY;
    }
  }

  // Store this action to check for duplicates
  window.lastRecordedAction = {
    type: actionData.type,
    selector: actionData.selector,
    timestamp: now
  };

  return false;
}

// Function to clean action data
function cleanActionData(actionData) {
  // Remove element reference (not serializable)
  delete actionData.element;
  
  // Clean up value for sensitive data
  if (actionData.type === 'type' && actionData.value) {
    // Don't record passwords
    if (actionData.element?.type === 'password') {
      actionData.value = '***';
    }
    
    // Truncate very long values
    if (actionData.value.length > 100) {
      actionData.value = actionData.value.substring(0, 100) + '...';
    }
  }
  
  // Clean up file paths
  if (actionData.type === 'upload' && actionData.value) {
    // Only keep filename, not full path
    const filename = actionData.value.split(/[\\/]/).pop();
    actionData.value = filename;
  }
  
  // Remove unnecessary properties
  delete actionData.event;
  delete actionData.originalEvent;
}

// Debounce map for typing
const typingDebounceMap = new Map();

// Track the last scroll event and its timestamp
let lastScrollEvent = null;
let lastScrollTimestamp = 0;

// Event listeners for different user interactions
function setupEventListeners() {
  // Enhanced click events with action type detection
  document.addEventListener('click', function(event) {
    if (!isRecording) return;
    
    const target = event.target;
    const selector = generateSelector(target);
    
    // Skip if clicking on extension elements
    if (target.closest('.playwright-recorder-overlay')) return;
    
    const actionType = determineActionType(target, event);
    if (!actionType) return; // Skip if action type is null
    
    // Debug logging for action type determination
    console.log('Action type determined:', actionType, 'for element:', target.tagName, target.type, target.getAttribute('data-testid'));
    
    const value = getElementValue(target);

    // Check if a scroll happened within the last 2 seconds
    let recentScroll = null;
    if (lastScrollEvent && Date.now() - lastScrollTimestamp <= 2000) {
      recentScroll = { ...lastScrollEvent };
    }

    recordAction({
      type: actionType,
      selector: selector,
      tagName: target.tagName.toLowerCase(),
      text: target.textContent?.trim().substring(0, 50) || '',
      value: value,
      x: event.clientX,
      y: event.clientY,
      checked: target.type === 'checkbox' ? target.checked : undefined,
      inputType: target.type || undefined,
      element: target,
      hasTooltip: target.hasAttribute('title') || target.hasAttribute('aria-label'),
      isImportant: target.getAttribute('role') === 'button' || target.hasAttribute('tabindex'),
      recentScroll: recentScroll // Attach recent scroll info if available
    });
  }, true);
  
  // Double-click events
  document.addEventListener('dblclick', function(event) {
    if (!isRecording) return;
    
    const target = event.target;
    const selector = generateSelector(target);
    
    // Skip if clicking on extension elements
    if (target.closest('.playwright-recorder-overlay')) return;
    
    recordAction({
      type: 'doubleClick',
      selector: selector,
      tagName: target.tagName.toLowerCase(),
      text: target.textContent?.trim().substring(0, 50) || '',
      x: event.clientX,
      y: event.clientY,
      element: target
    });
  }, true);
  
  // Right-click events
  document.addEventListener('contextmenu', function(event) {
    if (!isRecording) return;
    
    const target = event.target;
    const selector = generateSelector(target);
    
    // Skip if clicking on extension elements
    if (target.closest('.playwright-recorder-overlay')) return;
    
    recordAction({
      type: 'rightClick',
      selector: selector,
      tagName: target.tagName.toLowerCase(),
      text: target.textContent?.trim().substring(0, 50) || '',
      x: event.clientX,
      y: event.clientY,
      element: target
    });
  }, true);
  
  // Enhanced input/typing events with debounce
  document.addEventListener('input', function(event) {
    if (!isRecording) return;
    const target = event.target;
    if (!target || !(target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (target.closest('.playwright-recorder-overlay')) return;

    const selectorObj = generateSelector(target);
    const value = getElementValue(target);
    const debounceKey = selectorObj.value + ':' + (selectorObj.type || 'css');
    clearTimeout(typingDebounceMap.get(debounceKey));
    typingDebounceMap.set(debounceKey, setTimeout(() => {
      // Only record if value changed
      if (target._lastRecordedValue !== value) {
        recordAction({
          type: 'type',
          selector: selectorObj,
          tagName: target.tagName.toLowerCase(),
          value: value,
          element: target
        });
        target._lastRecordedValue = value;
      }
    }, 2000)); // 2s debounce
  }, true);
  
  // Focus events for better tracking
  document.addEventListener('focus', function(event) {
    if (!isRecording) return;
    
    const target = event.target;
    const selector = generateSelector(target);
    
    // Only record focus for form elements
    if (['input', 'select', 'textarea'].includes(target.tagName.toLowerCase())) {
      recordAction({
        type: 'focus',
        selector: selector,
        tagName: target.tagName.toLowerCase(),
        inputType: target.type || undefined,
        element: target
      });
    }
  }, true);
  
  // Blur events for form validation tracking
  document.addEventListener('blur', function(event) {
    if (!isRecording) return;
    
    const target = event.target;
    const selector = generateSelector(target);
    
    // Only record blur for form elements
    if (['input', 'select', 'textarea'].includes(target.tagName.toLowerCase())) {
      recordAction({
        type: 'blur',
        selector: selector,
        tagName: target.tagName.toLowerCase(),
        inputType: target.type || undefined,
        value: getElementValue(target)
      });
    }
  }, true);
  
  // Enhanced select change events
  document.addEventListener('change', function(event) {
    if (!isRecording) return;
    
    const target = event.target;
    const selector = generateSelector(target);
    
    if (target.tagName.toLowerCase() === 'select') {
      const value = getElementValue(target);
      const selectedOptions = target.multiple ? 
        Array.from(target.selectedOptions).map(opt => opt.textContent) :
        target.options[target.selectedIndex]?.textContent;
      
      recordAction({
        type: 'select',
        selector: selector,
        value: value,
        text: selectedOptions,
        tagName: 'select',
        multiple: target.multiple,
        element: target
      });
    } else if (target.type === 'checkbox' || target.type === 'radio') {
      recordAction({
        type: 'check',
        selector: selector,
        value: target.value,
        checked: target.checked,
        tagName: target.tagName.toLowerCase(),
        inputType: target.type,
        element: target
      });
    }
  }, true);
  
  // Form submission events
  document.addEventListener('submit', function(event) {
    if (!isRecording) return;
    
    const target = event.target;
    const selector = generateSelector(target);
    
    recordAction({
      type: 'submit',
      selector: selector,
      tagName: 'form',
      action: target.action || '',
      method: target.method || 'get'
    });
  }, true);
  
  // Hover events (with debouncing)
  let hoverTimeout;
  document.addEventListener('mouseover', function(event) {
    if (!isRecording) return;
    
    const target = event.target;
    const selector = generateSelector(target);
    
    clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => {
      recordAction({
        type: 'hover',
        selector: selector,
        tagName: target.tagName.toLowerCase(),
        text: target.textContent?.trim().substring(0, 50) || ''
      });
    }, 300);
  }, true);
  
  // Navigation events (for SPA navigation)
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (!isRecording) return;
    
    if (window.location.href !== lastUrl) {
      recordAction({
        type: 'navigate',
        url: window.location.href,
        previousUrl: lastUrl
      });
      lastUrl = window.location.href;
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Wait for elements to appear (useful for dynamic content)
  document.addEventListener('DOMNodeInserted', function(event) {
    if (!isRecording) return;
    
    const target = event.target;
    if (target.nodeType === Node.ELEMENT_NODE) {
      // Record waiting for new elements if they're interactive
      const interactiveElements = target.querySelectorAll('button, input, select, textarea, a, [role="button"]');
      if (interactiveElements.length > 0) {
        const selector = generateSelector(interactiveElements[0]);
        recordAction({
          type: 'wait',
          selector: selector,
          tagName: interactiveElements[0].tagName.toLowerCase(),
          reason: 'dynamic content loaded'
        });
      }
    }
  }, true);
  
  // Enhanced keyboard events
  document.addEventListener('keydown', function(event) {
    if (!isRecording) return;
    
    const target = event.target;
    const selector = generateSelector(target);
    
    // Skip if typing in extension elements
    if (target.closest('.playwright-recorder-overlay')) return;
    
    const actionType = determineActionType(target, event);
    if (!actionType) return; // Skip if action type is null
    
    const key = event.key;
    const isCtrl = event.ctrlKey || event.metaKey;
    const isShift = event.shiftKey;
    const isAlt = event.altKey;
    
    recordAction({
      type: actionType,
      selector: selector,
      key: key,
      modifiers: {
        ctrl: isCtrl,
        shift: isShift,
        alt: isAlt,
        meta: event.metaKey
      },
      element: target,
      elementType: target.tagName.toLowerCase()
    });
  }, true);
  
  // Scroll events
  let scrollTimeout;
  document.addEventListener('scroll', function(event) {
    if (!isRecording) return;

    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const target = event.target;
      const selector = target === document ? 'body' : generateSelector(target);
      const scrollData = {
        type: 'scroll',
        selector: selector,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        tagName: target.tagName ? target.tagName.toLowerCase() : 'body',
        timestamp: Date.now()
      };
      lastScrollEvent = scrollData;
      lastScrollTimestamp = scrollData.timestamp;
      recordAction(scrollData);
    }, 100);
  }, true);
  
  // Drag and drop events
  document.addEventListener('dragstart', function(event) {
    if (!isRecording) return;
    
    const target = event.target;
    const selector = generateSelector(target);
    
    recordAction({
      type: 'dragStart',
      selector: selector,
      tagName: target.tagName.toLowerCase(),
      text: target.textContent?.trim().substring(0, 50) || ''
    });
  }, true);
  
  document.addEventListener('drop', function(event) {
    if (!isRecording) return;
    
    const target = event.target;
    const selector = generateSelector(target);
    
    recordAction({
      type: 'drop',
      selector: selector,
      tagName: target.tagName.toLowerCase(),
      text: target.textContent?.trim().substring(0, 50) || ''
    });
  }, true);
}

// Visual feedback for recording
function showRecordingIndicator() {
  if (recordingIndicator) {
    // Already showing, just update text
    recordingIndicator.textContent = '🔴 Recording...';
    return;
  }

  console.log('Showing recording indicator...');

  const overlay = document.createElement('div');
  overlay.className = 'playwright-recorder-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 16px;
    right: 16px;
    background: rgba(255, 0, 0, 0.92);
    color: white;
    padding: 14px 22px 14px 16px;
    border-radius: 8px;
    font-family: Arial, sans-serif;
    font-size: 18px;
    z-index: 999999;
    pointer-events: auto;
    box-shadow: 0 2px 12px rgba(0,0,0,0.18);
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    animation: pulse 1.2s infinite cubic-bezier(.4,0,.6,1);
  `;
  overlay.title = 'Playwright Recorder is actively recording actions on this page.';

  // Add help icon with tooltip
  const helpIcon = document.createElement('span');
  helpIcon.textContent = '❓';
  helpIcon.style.cssText = 'margin-left:8px;font-size:16px;cursor:pointer;';
  helpIcon.title = 'The recorder captures your actions for test generation. Click to learn more.';
  helpIcon.onclick = (e) => {
    e.stopPropagation();
    alert('The Playwright Recorder is capturing your actions (clicks, scrolls, typing, etc.) to generate automated tests.');
  };
  overlay.appendChild(document.createTextNode('🔴 Recording...'));
  overlay.appendChild(helpIcon);

  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(255,0,0,0.7); opacity: 1; }
      70% { box-shadow: 0 0 0 12px rgba(255,0,0,0.15); opacity: 0.85; }
      100% { box-shadow: 0 0 0 0 rgba(255,0,0,0.7); opacity: 1; }
    }
  `;

  // Only add style if it doesn't exist
  if (!document.querySelector('#playwright-recorder-style')) {
    style.id = 'playwright-recorder-style';
    document.head.appendChild(style);
  }

  document.body.appendChild(overlay);
  recordingIndicator = overlay;

  console.log('Recording indicator shown');
}

function hideRecordingIndicator() {
  console.log('Hiding recording indicator...');
  if (recordingIndicator) {
    recordingIndicator.remove();
    recordingIndicator = null;
  }
  
  // Also remove any existing indicators
  const existingOverlays = document.querySelectorAll('.playwright-recorder-overlay');
  existingOverlays.forEach(overlay => overlay.remove());
  
  console.log('Recording indicator hidden');
}

// Function to check recording status from background script
function checkRecordingStatus() {
  const now = Date.now();
  if (now - lastStatusCheck < 500) {
    // Don't check too frequently, but allow more frequent checks
    return;
  }
  lastStatusCheck = now;
  
  // Check if extension context is still valid
  if (!chrome.runtime || !chrome.runtime.id) {
    console.warn('Extension context invalidated during status check');
    isRecording = false;
    hideRecordingIndicator();
    cleanup();
    return;
  }
  
  console.log('Checking recording status...');
  
  try {
    chrome.runtime.sendMessage({ action: 'getRecordingStatus' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('Failed to get recording status:', chrome.runtime.lastError);
        
        // Check if it's a context invalidation error
        if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
          console.error('Extension context invalidated, stopping recording');
          isRecording = false;
          hideRecordingIndicator();
          cleanup();
          return;
        }
        
        reconnectAttempts++;
        if (reconnectAttempts < maxReconnectAttempts) {
          // Retry after a short delay
          setTimeout(checkRecordingStatus, 500);
        }
        return;
      }
      
      console.log('Recording status response:', response);
      
      if (response && response.isRecording !== isRecording) {
        console.log('Recording status changed:', response.isRecording, 'was:', isRecording);
        isRecording = response.isRecording;
        if (isRecording) {
          showRecordingIndicator();
          console.log('Recording reconnected and resumed');
        } else {
          hideRecordingIndicator();
          console.log('Recording stopped');
        }
      } else if (response && response.isRecording === true && !recordingIndicator) {
        // Recording is active but no indicator shown
        console.log('Recording is active but no indicator, showing it...');
        showRecordingIndicator();
      }
      
      reconnectAttempts = 0; // Reset reconnect attempts on successful communication
    });
  } catch (error) {
    console.error('Error checking recording status:', error);
    if (error.message.includes('Extension context invalidated')) {
      isRecording = false;
      hideRecordingIndicator();
      cleanup();
    }
  }
}

// Function to handle page visibility changes
function handleVisibilityChange() {
  console.log('Visibility changed, hidden:', document.hidden);
  if (!document.hidden) {
    // Page became visible again, check recording status immediately
    setTimeout(checkRecordingStatus, 100);
  }
}

// Function to handle window focus changes
function handleWindowFocus() {
  console.log('Window focused, checking recording status');
  setTimeout(checkRecordingStatus, 100);
}

// Function to handle window blur
function handleWindowBlur() {
  console.log('Window blurred');
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('=== CONTENT SCRIPT: MESSAGE RECEIVED ===');
  console.log('Message:', request);
  
  // Check if extension context is still valid
  if (!chrome.runtime || !chrome.runtime.id) {
    console.warn('Extension context invalidated, cannot process message');
    return;
  }
  
  console.log('Content script received message:', request.action);
  
  try {
    switch (request.action) {
      case 'startRecording':
        console.log('=== CONTENT SCRIPT: STARTING RECORDING ===');
        isRecording = true;
        currentUrl = window.location.href;
        console.log('Recording state set:', { isRecording, currentUrl });
        showRecordingIndicator();
        
        // Record initial page load
        console.log('Recording initial navigation...');
        recordAction({
          type: 'navigate',
          url: currentUrl,
          previousUrl: ''
        });
        
        console.log('Sending success response to background');
        sendResponse({ success: true });
        break;
        
      case 'stopRecording':
        console.log('=== CONTENT SCRIPT: STOPPING RECORDING ===');
        isRecording = false;
        hideRecordingIndicator();
        sendResponse({ success: true });
        break;
        
      case 'getRecordingStatus':
        console.log('Content script status check:', { isRecording });
        sendResponse({ isRecording: isRecording });
        break;
        
      case 'ping':
        // Simple ping to check if content script is alive
        console.log('Content script ping received');
        sendResponse({ success: true, isRecording: isRecording });
        break;
        
      case 'forceReconnect':
        // Force reconnection to recording state
        console.log('Force reconnecting to recording state...');
        checkRecordingStatus();
        sendResponse({ success: true });
        break;
    }
  } catch (error) {
    console.error('Error processing message:', error);
    if (error.message.includes('Extension context invalidated')) {
      isRecording = false;
      hideRecordingIndicator();
      cleanup();
    }
  }
  
  return true;
});

// Always set up event listeners immediately
setupEventListeners();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

function initializeExtension() {
  if (isInitialized) {
    console.log('Extension already initialized');
    return;
  }
  
  console.log('Initializing Playwright Recorder extension...');
  
  // Check recording status on initialization
  setTimeout(checkRecordingStatus, 100);
  
  // Listen for page visibility changes
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Listen for window focus/blur events
  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('blur', handleWindowBlur);
  
  // Listen for page unload to notify background script
  window.addEventListener('beforeunload', () => {
    if (isRecording) {
      chrome.runtime.sendMessage({ 
        action: 'pageUnloading',
        url: window.location.href 
      });
    }
  });
  
  // Very frequent status check to ensure connection
  statusCheckInterval = setInterval(() => {
    checkRecordingStatus();
  }, 2000); // Check every 2 seconds
  
  // Also check when user interacts with the page
  document.addEventListener('click', () => {
    setTimeout(checkRecordingStatus, 50);
  }, true);
  
  document.addEventListener('keydown', () => {
    setTimeout(checkRecordingStatus, 50);
  }, true);
  
  document.addEventListener('mousemove', () => {
    // Check status on mouse movement (throttled)
    if (!isRecording) {
      setTimeout(checkRecordingStatus, 100);
    }
  }, true);
  
  isInitialized = true;
  console.log('Extension initialization complete');
}

// Also setup listeners for dynamically added content
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Re-setup event listeners for new elements if needed
          // (The event delegation should handle most cases)
        }
      });
    }
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Cleanup function
function cleanup() {
  console.log('Cleaning up extension...');
  
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
    statusCheckInterval = null;
  }
  
  // Remove all event listeners
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('focus', handleWindowFocus);
  window.removeEventListener('blur', handleWindowBlur);
  window.removeEventListener('beforeunload', cleanup);
  
  // Hide recording indicator
  hideRecordingIndicator();
  
  // Reset state
  isRecording = false;
  isInitialized = false;
  
  console.log('Cleanup complete');
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanup);

// Also cleanup when extension context is invalidated
window.addEventListener('error', (event) => {
  if (event.error && event.error.message && event.error.message.includes('Extension context invalidated')) {
    console.warn('Extension context invalidated, cleaning up...');
    cleanup();
  }
});

console.log('Playwright Recorder Content Script Loaded'); 