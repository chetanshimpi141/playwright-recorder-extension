const { test, expect } = require('@playwright/test');

test('Frame Handling Example - iframe and shadow DOM', async ({ page }) => {
  // Navigate to the starting URL
  await page.goto('https://example.com/embedded-content');
  
  // Click on main page button
  await page.click('#main-button');
  
  // Wait for iframe to load
  await page.waitForSelector('iframe[name="embedded-form"]');
  
  // Click on element inside iframe
  await page.frameLocator('iframe[name="embedded-form"]').click('#username');
  
  // Type in iframe input field
  await page.frameLocator('iframe[name="embedded-form"]').fill('#username', 'testuser@example.com');
  
  // Select option in iframe dropdown
  await page.frameLocator('iframe[name="embedded-form"]').selectOption('#country', 'US');
  
  // Check checkbox in iframe
  await page.frameLocator('iframe[name="embedded-form"]').check('#terms');
  
  // Click submit button in iframe
  await page.frameLocator('iframe[name="embedded-form"]').click('button[type="submit"]');
  
  // Wait for success message in iframe
  await page.frameLocator('iframe[name="embedded-form"]').waitForSelector('.success-message');
  
  // Navigate to page with shadow DOM
  await page.goto('https://example.com/shadow-components');
  
  // Click on shadow DOM host element
  await page.click('#shadow-host');
  
  // Click on element inside shadow DOM
  await page.locator('#shadow-host').shadowRoot().click('.shadow-button');
  
  // Type in shadow DOM input
  await page.locator('#shadow-host').shadowRoot().fill('.shadow-input', 'shadow value');
  
  // Select option in shadow DOM dropdown
  await page.locator('#shadow-host').shadowRoot().selectOption('.shadow-select', 'option1');
  
  // Check checkbox in shadow DOM
  await page.locator('#shadow-host').shadowRoot().check('.shadow-checkbox');
  
  // Navigate to page with nested frames
  await page.goto('https://example.com/nested-frames');
  
  // Click on element in nested iframe
  await page.frameLocator('iframe[name="parent-frame"]').frameLocator('iframe[name="child-frame"]').click('#nested-button');
  
  // Type in nested iframe
  await page.frameLocator('iframe[name="parent-frame"]').frameLocator('iframe[name="child-frame"]').fill('#nested-input', 'nested value');
  
  // Navigate to page with shadow DOM inside iframe
  await page.goto('https://example.com/complex-embedded');
  
  // Access shadow DOM inside iframe
  await page.frameLocator('iframe[name="complex-frame"]').locator('#shadow-container').shadowRoot().click('.complex-button');
  
  // Type in shadow DOM inside iframe
  await page.frameLocator('iframe[name="complex-frame"]').locator('#shadow-container').shadowRoot().fill('.complex-input', 'complex value');
  
  // Select option in shadow DOM inside iframe
  await page.frameLocator('iframe[name="complex-frame"]').locator('#shadow-container').shadowRoot().selectOption('.complex-select', 'complex-option');
  
  // Add your assertions here
  await expect(page.frameLocator('iframe[name="embedded-form"]').locator('.success-message')).toBeVisible();
  await expect(page.locator('#shadow-host').shadowRoot().locator('.shadow-input')).toHaveValue('shadow value');
  await expect(page.frameLocator('iframe[name="complex-frame"]').locator('#shadow-container').shadowRoot().locator('.complex-input')).toHaveValue('complex value');
}); 