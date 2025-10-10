const { test, expect } = require('@playwright/test');

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login and register buttons', async ({ page }) => {
    await expect(page.locator('#loginBtn')).toBeVisible();
    await expect(page.locator('#registerBtn')).toBeVisible();
  });

  test('should open login modal when login button is clicked', async ({ page }) => {
    await page.click('#loginBtn');
    await expect(page.locator('#loginModal')).toBeVisible();
    await expect(page.locator('#loginEmail')).toBeVisible();
    await expect(page.locator('#loginPassword')).toBeVisible();
  });

  test('should open register modal when register button is clicked', async ({ page }) => {
    await page.click('#registerBtn');
    await expect(page.locator('#registerModal')).toBeVisible();
    await expect(page.locator('#registerName')).toBeVisible();
    await expect(page.locator('#registerEmail')).toBeVisible();
    await expect(page.locator('#registerPassword')).toBeVisible();
    await expect(page.locator('#businessType')).toBeVisible();
  });

  test('should close modal when close button is clicked', async ({ page }) => {
    await page.click('#loginBtn');
    await expect(page.locator('#loginModal')).toBeVisible();
    
    await page.click('#closeLoginModal');
    await expect(page.locator('#loginModal')).not.toBeVisible();
  });

  test('should register a new user successfully', async ({ page }) => {
    const timestamp = Date.now();
    const testEmail = `test${timestamp}@example.com`;
    
    await page.click('#registerBtn');
    
    await page.fill('#registerName', 'Test User');
    await page.fill('#registerEmail', testEmail);
    await page.fill('#registerPassword', 'password123');
    await page.selectOption('#businessType', 'farmer');
    
    // Mock the API response for successful registration
    await page.route('**/api/auth/register', (route) => {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: '507f1f77bcf86cd799439011',
              name: 'Test User',
              email: testEmail,
              role: 'user',
              businessType: 'farmer'
            },
            token: 'mock-jwt-token'
          }
        })
      });
    });
    
    await page.click('#registerForm button[type="submit"]');
    
    // Should show success notification and close modal
    await expect(page.locator('.fixed.top-4.right-4')).toContainText('Đăng ký thành công!');
    await expect(page.locator('#registerModal')).not.toBeVisible();
  });

  test('should login existing user successfully', async ({ page }) => {
    await page.click('#loginBtn');
    
    await page.fill('#loginEmail', 'test@example.com');
    await page.fill('#loginPassword', 'password123');
    
    // Mock the API response for successful login
    await page.route('**/api/auth/login', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: '507f1f77bcf86cd799439011',
              name: 'Test User',
              email: 'test@example.com',
              role: 'user',
              businessType: 'farmer'
            },
            token: 'mock-jwt-token'
          }
        })
      });
    });
    
    await page.click('#loginForm button[type="submit"]');
    
    // Should show success notification and update UI
    await expect(page.locator('.fixed.top-4.right-4')).toContainText('Đăng nhập thành công!');
    await expect(page.locator('#loginModal')).not.toBeVisible();
    await expect(page.locator('#registerBtn')).toContainText('Xin chào, Test User');
  });

  test('should show error for invalid login credentials', async ({ page }) => {
    await page.click('#loginBtn');
    
    await page.fill('#loginEmail', 'invalid@example.com');
    await page.fill('#loginPassword', 'wrongpassword');
    
    // Mock the API response for failed login
    await page.route('**/api/auth/login', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Invalid credentials'
        })
      });
    });
    
    await page.click('#loginForm button[type="submit"]');
    
    // Should show error notification and keep modal open
    await expect(page.locator('.fixed.top-4.right-4')).toContainText('Invalid credentials');
    await expect(page.locator('#loginModal')).toBeVisible();
  });

  test('should validate required fields in registration form', async ({ page }) => {
    await page.click('#registerBtn');
    
    // Try to submit without filling required fields
    await page.click('#registerForm button[type="submit"]');
    
    // HTML5 validation should prevent submission
    await expect(page.locator('#registerName:invalid')).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    await page.click('#loginBtn');
    
    await page.fill('#loginEmail', 'invalid-email');
    await page.fill('#loginPassword', 'password123');
    
    // Try to submit with invalid email
    await page.click('#loginForm button[type="submit"]');
    
    // HTML5 validation should prevent submission
    await expect(page.locator('#loginEmail:invalid')).toBeVisible();
  });

  test('should logout user when logout is clicked', async ({ page }) => {
    // First login
    await page.click('#loginBtn');
    await page.fill('#loginEmail', 'test@example.com');
    await page.fill('#loginPassword', 'password123');
    
    await page.route('**/api/auth/login', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: { id: '1', name: 'Test User', email: 'test@example.com' },
            token: 'mock-token'
          }
        })
      });
    });
    
    await page.click('#loginForm button[type="submit"]');
    await page.waitForTimeout(1000);
    
    // Now logout
    await page.click('#registerBtn'); // This becomes logout button after login
    
    // Should reload page and return to original state
    await expect(page.locator('#loginBtn')).toBeVisible();
    await expect(page.locator('#registerBtn')).toContainText('Đăng ký');
  });
});