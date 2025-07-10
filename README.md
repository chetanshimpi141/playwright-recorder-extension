# 🎭 Playwright Test Recorder Extension

A Chrome extension that records user interactions on web applications and generates Playwright test scripts automatically. Perfect for manual testers and automation engineers who want to quickly create test scripts while performing manual testing.

## ✨ Features

- **Real-time Recording**: Capture clicks, typing, form submissions, and navigation
- **Enhanced Action Support**: Double-clicks, right-clicks, checkboxes, radio buttons, file uploads
- **Multi-language Support**: Generate code in JavaScript, TypeScript, Python, and Java
- **Smart Selectors**: Enhanced selector generation with accessibility and testing best practices
- **Script Preview**: Preview generated code before downloading
- **Step Editing**: Edit, delete, and reorder recorded steps
- **Visual Feedback**: Recording indicator shows when the extension is active
- **File Download**: Download final test files after editing
- **Custom File Names**: Choose your own test file name
- **Modern UI**: Beautiful, intuitive interface with modal dialogs

## 🚀 Installation

### Method 1: Load as Unpacked Extension (Development)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension folder
5. The extension icon should appear in your Chrome toolbar

### Method 2: Install from Chrome Web Store (Coming Soon)

*This extension will be available on the Chrome Web Store soon*

## 📖 Usage

### Basic Workflow

1. **Open your web application** in Chrome
2. **Click the extension icon** in the toolbar
3. **Enter a file name** for your test (e.g., "login-test")
4. **Select your preferred language** (JavaScript, TypeScript, Python, or Java)
5. **Click "Start Recording"**
6. **Perform your manual testing** - click buttons, fill forms, navigate pages
7. **Click "Stop Recording"** when done
8. **Preview the generated script** in the extension popup
9. **Edit recorded steps** if needed (delete, reorder, modify)
10. **Download the final test file** when satisfied

### Supported Actions

The extension records the following user interactions:

- ✅ **Clicks** on buttons, links, and other elements
- ✅ **Double-clicks** for editing and special interactions
- ✅ **Right-clicks** for context menus
- ✅ **Text input** in form fields and textareas
- ✅ **Checkbox interactions** (check/uncheck)
- ✅ **Radio button selections**
- ✅ **Dropdown selections** (single and multiple)
- ✅ **File uploads**
- ✅ **Form submissions**
- ✅ **Page navigation** (including SPA navigation)
- ✅ **Hover events**
- ✅ **Focus and blur events**
- ✅ **Keyboard events** (Enter, Tab, Escape, Arrow keys)
- ✅ **Scroll events**
- ✅ **Drag and drop interactions**
- ✅ **Dynamic content** waiting
- ✅ **Frame interactions** (iframes, shadow DOM, nested frames)

### Generated Code Examples

#### JavaScript/TypeScript
```javascript
const { test, expect } = require('@playwright/test');

test('Enhanced Recorded Test - form-interaction', async ({ page }) => {
  // Navigate to the starting URL
  await page.goto('https://example.com/forms');
  
  // Focus on username field
  await page.focus('#username');
  
  // Type in username field
  await page.fill('#username', 'testuser@example.com');
  
  // Check the "Remember me" checkbox
  await page.check('#remember-me');
  
  // Select option in country dropdown
  await page.selectOption('#country', 'US');
  
  // Select multiple options in interests dropdown
  await page.selectOption('#interests', ['reading', 'gaming', 'sports']);
  
  // Upload file to file input
  await page.setInputFiles('#profile-picture', 'path/to/your/file');
  
  // Double-click on profile name to edit
  await page.dblclick('.profile-name');
  
  // Right-click on settings menu
  await page.click('.settings-menu', { button: 'right' });
  
  // Press Enter to save
  await page.press('.profile-name', 'Enter');
});
```

#### Python
```python
from playwright.sync_api import sync_playwright, expect

def test_recorded_form_interaction():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        
        # Navigate to the starting URL
        page.goto('https://example.com/forms')
        
        # Focus on username field
        page.focus('#username')
        
        # Type in username field
        page.fill('#username', 'testuser@example.com')
        
        # Check the "Remember me" checkbox
        page.check('#remember-me')
        
        # Select option in country dropdown
        page.select_option('#country', 'US')
        
        # Double-click on profile name to edit
        page.dblclick('.profile-name')
        
        # Right-click on settings menu
        page.click('.settings-menu', button='right')
        
        browser.close()
```

#### Frame Handling Example
```javascript
const { test, expect } = require('@playwright/test');

test('Frame Handling Example', async ({ page }) => {
  // Navigate to page with embedded content
  await page.goto('https://example.com/embedded-content');
  
  // Click on element inside iframe
  await page.frameLocator('iframe[name="embedded-form"]').click('#username');
  
  // Type in iframe input field
  await page.frameLocator('iframe[name="embedded-form"]').fill('#username', 'testuser@example.com');
  
  // Click on element inside shadow DOM
  await page.locator('#shadow-host').shadowRoot().click('.shadow-button');
  
  // Type in shadow DOM input
  await page.locator('#shadow-host').shadowRoot().fill('.shadow-input', 'shadow value');
  
  // Handle nested frames
  await page.frameLocator('iframe[name="parent-frame"]').frameLocator('iframe[name="child-frame"]').click('#nested-button');
  
  // Handle shadow DOM inside iframe
  await page.frameLocator('iframe[name="complex-frame"]').locator('#shadow-container').shadowRoot().click('.complex-button');
});
```

## 🛠️ Technical Details

### Architecture

- **Manifest V3**: Modern Chrome extension architecture
- **Content Script**: Captures DOM events and user interactions
- **Background Script**: Manages recording state and code generation
- **Popup UI**: User interface for controlling recording

### Selector Generation Strategy

The extension uses an enhanced smart selector generation algorithm:

1. **ID selectors** (highest priority): `#element-id`
2. **Data attributes**: `[data-testid="..."]`, `[data-cy="..."]`, `[data-automation="..."]`, `[data-qa="..."]`
3. **Name attributes**: `[name="..."]`
4. **Aria labels**: `[aria-label="..."]`
5. **Placeholder text**: `[placeholder="..."]`
6. **Alt text**: `[alt="..."]`
7. **Title attributes**: `[title="..."]`
8. **Text content**: `button:has-text("Submit")`
9. **Role attributes**: `[role="button"]`
10. **Type attributes**: `input[type="email"]`
11. **Class selectors** (filtered): `.class1.class2` (excludes framework classes)
12. **Path-based selectors** (fallback): `div > form > input:nth-child(1)`

### Frame Handling

The extension automatically detects and handles elements inside:

- **Iframes**: Automatically generates `frameLocator()` calls
- **Shadow DOM**: Automatically generates `shadowRoot()` calls
- **Nested frames**: Handles multiple levels of iframe nesting
- **Complex scenarios**: Shadow DOM inside iframes, multiple shadow roots

**Frame Detection Priority:**
1. **Iframe detection**: By ID, name, src attribute, or path-based selector
2. **Shadow DOM detection**: By host element ID, class, or path-based selector
3. **Nested frame support**: Multiple levels of frame nesting
4. **Cross-frame actions**: Seamless interaction across frame boundaries

### Supported Languages

| Language | File Extension | Framework |
|----------|----------------|-----------|
| JavaScript | `.spec.js` | Playwright Test |
| TypeScript | `.spec.ts` | Playwright Test |
| Python | `.py` | Playwright Python |
| Java | `.java` | Playwright Java |

## 🔧 Customization

### Adding New Languages

To add support for additional languages, modify the `background.js` file:

1. Add the language option to the popup HTML
2. Create a new generator function (e.g., `generateCSharpCode`)
3. Add the case in the `generatePlaywrightCode` function

### Custom Selectors

The extension prioritizes certain attributes for selector generation. You can modify the `generateSelector` function in `content.js` to:

- Add support for custom data attributes
- Change selector priority
- Implement custom selector strategies

## 🐛 Troubleshooting

### Common Issues

**Extension not recording actions:**
- Ensure the extension is enabled
- Check that you're on a supported website (not chrome:// URLs)
- Verify the content script is loaded (check console for "Playwright Recorder Content Script Loaded")

**Generated selectors not working:**
- The extension uses fallback selectors when unique identifiers aren't available
- Consider adding `data-testid` attributes to your application elements
- Review and modify the generated selectors as needed

**File not downloading:**
- Check Chrome's download settings
- Ensure the extension has download permissions
- Try refreshing the page and recording again

### Debug Mode

To enable debug logging:

1. Open Chrome DevTools
2. Go to the Console tab
3. Look for messages starting with "Playwright Recorder"

## 🤝 Contributing

Contributions are welcome! Here are some areas where you can help:

- **New language support** (C#, Ruby, etc.)
- **Additional action types** (drag & drop, file uploads)
- **Improved selector generation**
- **UI/UX enhancements**
- **Bug fixes and performance improvements**

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [Playwright](https://playwright.dev/)
- Inspired by existing test recording tools
- Community feedback and suggestions

## 📞 Support

If you encounter any issues or have questions:

1. Check the troubleshooting section above
2. Search existing issues on GitHub
3. Create a new issue with detailed information

---

**Happy Testing! 🎭✨** 