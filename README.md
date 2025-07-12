# 🎭 Playwright Recorder Extension

A powerful Chrome extension that records user interactions and generates high-quality Playwright test scripts with AI-powered code generation.

## ✨ Features

### 🎯 Core Recording
- **Real-time action capture** - Records clicks, typing, navigation, form submissions, and more
- **Smart selector generation** - Uses robust, stable selectors (data-testid, getByRole, getByLabel)
- **Frame support** - Handles iframes, shadow DOM, and nested frames
- **Multi-language support** - JavaScript, TypeScript, Python, and Java
- **Cross-platform** - Works on any website (except chrome:// URLs)

### 🤖 AI-Powered Code Generation (NEW!)
- **Intelligent code generation** - Uses AI to create production-ready test scripts
- **Context-aware** - Understands user intent and workflow patterns
- **Smart assertions** - Automatically generates relevant assertions
- **Error handling** - Includes proper error handling and waits
- **Logical grouping** - Groups related actions into meaningful test steps
- **Multiple AI providers** - Support for OpenAI GPT-4, GPT-3.5, and Claude models

## 🚀 Quick Start

### Installation

1. **Clone or download** this repository
2. **Open Chrome** and go to `chrome://extensions/`
3. **Enable Developer mode** (toggle in top right)
4. **Click "Load unpacked"** and select the extension folder
5. **Pin the extension** to your toolbar for easy access

### Basic Usage

1. **Navigate** to the website you want to test
2. **Click the extension icon** to open the popup
3. **Configure AI settings** (optional but recommended)
4. **Enter a test file name** and select your preferred language
5. **Click "Start Recording"** and perform your test actions
6. **Click "Stop Recording"** when finished
7. **Preview, edit, and download** your generated test script

## 🤖 AI Configuration

### Setup AI-Powered Generation

1. **Enable AI** - Toggle the AI switch in the extension popup
2. **Get an API key** - Sign up for an AI service:
   - [OpenAI API](https://platform.openai.com/api-keys) (GPT-4, GPT-3.5)
   - [Anthropic API](https://console.anthropic.com/) (Claude)
3. **Enter your API key** - Paste it in the extension popup
4. **Select your model** - Choose from available AI models
5. **Test connection** - The extension will validate your API key

### AI Benefits

**Traditional Generation:**
```javascript
// Basic template-based code
await page.click('[class="btn-primary"]');
await page.fill('[class="input-field"]', 'test@example.com');
await page.click('[class="submit-btn"]');
```

**AI-Powered Generation:**
```javascript
// Intelligent, context-aware code
test('User registration flow', async ({ page }) => {
  await test.step('Navigate to registration page', async () => {
    await page.goto('https://example.com/register');
    await expect(page).toHaveTitle(/Register/);
  });

  await test.step('Fill registration form', async () => {
    await page.getByLabel('Email address').fill('test@example.com');
    await page.getByLabel('Password').fill('securePassword123');
    await page.getByLabel('Confirm password').fill('securePassword123');
    
    // AI-generated assertion
    await expect(page.getByLabel('Email address')).toHaveValue('test@example.com');
  });

  await test.step('Submit registration', async () => {
    await page.getByRole('button', { name: 'Create Account' }).click();
    
    // AI-generated wait and assertion
    await expect(page.getByText('Registration successful')).toBeVisible();
  });
});
```

## 📋 Supported Actions

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

## 🎯 Selector Strategy

The extension uses a smart selector strategy that prioritizes stability and maintainability:

### Priority Order:
1. **data-testid** attributes: `[data-testid="submit-button"]`
2. **getByRole** with accessible name: `getByRole('button', { name: 'Submit' })`
3. **getByLabel** for form fields: `getByLabel('Email address')`
4. **getByPlaceholder** for inputs: `getByPlaceholder('Enter your email')`
5. **getByAltText** for images: `getByAltText('Logo')`
6. **getByTitle** for elements with titles: `getByTitle('Help')`
7. **Unique IDs**: `#submit-button`
8. **Name attributes**: `[name="email"]`
9. **Full class attributes**: `[class="btn btn-primary"]` (not `.btn.btn-primary`)
10. **Path-based selectors** (fallback): `div > form > input:nth-child(1)`

### Frame Handling

The extension automatically detects and handles elements inside:

- **Iframes**: Automatically generates `frameLocator()` calls
- **Shadow DOM**: Automatically generates `shadowRoot()` calls
- **Nested frames**: Handles multiple levels of iframe nesting
- **Complex scenarios**: Shadow DOM inside iframes, multiple shadow roots

## 🌐 Supported Languages

| Language | File Extension | Framework | AI Support |
|----------|----------------|-----------|------------|
| JavaScript | `.spec.js` | Playwright Test | ✅ |
| TypeScript | `.spec.ts` | Playwright Test | ✅ |
| Python | `.py` | Playwright Python | ✅ |
| Java | `.java` | Playwright Java | ✅ |

## 🔧 Configuration

### AI Settings

```javascript
// Available AI Models
const AI_MODELS = {
  'gpt-4': 'GPT-4 (Recommended)',
  'gpt-3.5-turbo': 'GPT-3.5 Turbo',
  'claude-3-opus': 'Claude 3 Opus',
  'claude-3-sonnet': 'Claude 3 Sonnet'
};

// AI Configuration
const AI_CONFIG = {
  enabled: true,
  apiEndpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4',
  maxTokens: 4000,
  temperature: 0.3
};
```

### Customization Options

1. **Selector Priority** - Modify `generateSelector()` in `content.js`
2. **AI Prompts** - Customize `createAIPrompt()` in `background.js`
3. **Code Templates** - Edit language-specific generators
4. **Action Filtering** - Adjust `shouldSkipAction()` logic

## 🐛 Troubleshooting

### Common Issues

**Extension not recording actions:**
- Ensure the extension is enabled
- Check that you're on a supported website (not chrome:// URLs)
- Verify the content script is loaded (check console for "Playwright Recorder Content Script Loaded")

**AI generation not working:**
- Verify your API key is correct and has sufficient credits
- Check that the selected AI model is available
- Ensure you have an active internet connection
- Check the browser console for error messages

**Generated code has issues:**
- Try enabling AI-powered generation for better quality
- Review and edit the recorded steps before generating
- Check that the website uses stable selectors
- Consider adding custom data-testid attributes to your application

**Recording stops unexpectedly:**
- Check for "Extension context invalidated" errors
- Refresh the page and restart recording
- Ensure the extension has necessary permissions

### Debug Mode

Enable detailed logging by opening the browser console and looking for:
- `[Playwright Recorder]` prefixed messages
- Action recording logs
- AI generation progress
- Error messages and stack traces

## 🔒 Security & Privacy

### Data Handling
- **Local processing** - All recording happens locally in your browser
- **No data sent** - Actions are not sent to external servers (except AI API when enabled)
- **Secure storage** - API keys are stored securely in Chrome's sync storage
- **Optional AI** - AI features are completely optional and can be disabled

### API Key Security
- API keys are stored locally in Chrome's encrypted storage
- Keys are only sent to the configured AI service
- No keys are logged or stored in plain text
- You can revoke API keys at any time from your AI service dashboard

## 🤝 Contributing

### Development Setup

1. **Clone the repository**
2. **Load as unpacked extension** in Chrome
3. **Make changes** to the code
4. **Reload the extension** to test changes
5. **Submit a pull request** with your improvements

### Areas for Contribution

- **New language support** - Add support for additional programming languages
- **AI provider integration** - Add support for more AI services
- **Selector strategies** - Improve element detection and selector generation
- **UI improvements** - Enhance the popup interface and user experience
- **Documentation** - Improve README, add examples, and tutorials

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Playwright Team** - For the amazing testing framework
- **OpenAI & Anthropic** - For providing AI capabilities
- **Chrome Extensions Team** - For the extension platform
- **Open Source Community** - For inspiration and contributions

---

**Happy Testing! 🎭✨** 