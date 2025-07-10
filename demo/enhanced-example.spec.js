const { test, expect } = require('@playwright/test');

test('Enhanced Recorded Test - form-interaction', async ({ page }) => {
  // Navigate to the starting URL
  await page.goto('https://example.com/forms');
  
  // Focus on username field
  await page.focus('#username');
  
  // Type in username field
  await page.fill('#username', 'testuser@example.com');
  
  // Focus on password field
  await page.focus('#password');
  
  // Type in password field
  await page.fill('#password', 'securepassword123');
  
  // Check the "Remember me" checkbox
  await page.check('#remember-me');
  
  // Select option in country dropdown
  await page.selectOption('#country', 'US');
  
  // Select multiple options in interests dropdown
  await page.selectOption('#interests', ['reading', 'gaming', 'sports']);
  
  // Type in textarea
  await page.fill('#bio', 'This is a test bio for automation testing.');
  
  // Upload file to file input
  await page.setInputFiles('#profile-picture', 'path/to/your/file');
  
  // Hover over help icon
  await page.hover('.help-icon');
  
  // Click on submit button
  await page.click('button[type="submit"]');
  
  // Wait for navigation to dashboard
  await page.waitForSelector('.dashboard-container');
  
  // Double-click on profile name to edit
  await page.dblclick('.profile-name');
  
  // Type new name
  await page.fill('.profile-name', 'Updated Name');
  
  // Press Enter to save
  await page.press('.profile-name', 'Enter');
  
  // Right-click on settings menu
  await page.click('.settings-menu', { button: 'right' });
  
  // Click on settings option
  await page.click('.settings-link');
  
  // Navigate to settings page
  await page.goto('https://example.com/settings');
  
  // Scroll to email preferences
  await page.evaluate(() => window.scrollTo(0, 500));
  
  // Click on email preferences
  await page.click('#email-preferences');
  
  // Select notification frequency
  await page.selectOption('#notification-frequency', 'daily');
  
  // Uncheck marketing emails
  await page.uncheck('#marketing-emails');
  
  // Select radio button for theme
  await page.check('#dark-theme');
  
  // Press Tab to navigate
  await page.press('#dark-theme', 'Tab');
  
  // Click save button
  await page.click('.save-button');
  
  // Wait for success message
  await page.waitForSelector('.success-message');
  
  // Add your assertions here
  await expect(page.locator('.success-message')).toBeVisible();
  await expect(page.locator('.user-email')).toContainText('testuser@example.com');
  await expect(page.locator('#dark-theme')).toBeChecked();
}); 