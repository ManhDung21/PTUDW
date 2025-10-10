const { test, expect } = require('@playwright/test');

test.describe('UI Interactions and Responsiveness', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display all main UI elements', async ({ page }) => {
    // Navigation
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('h1:has-text("AI Product Description")')).toBeVisible();
    
    // Hero section
    await expect(page.locator('h2:has-text("Tạo mô tả sản phẩm tự động bằng AI")')).toBeVisible();
    await expect(page.locator('p:has-text("Chỉ cần tải lên hình ảnh")')).toBeVisible();
    
    // Upload section
    await expect(page.locator('h3:has-text("Tải lên hình ảnh sản phẩm")')).toBeVisible();
    await expect(page.locator('#uploadArea')).toBeVisible();
    
    // Features section
    await expect(page.locator('h2:has-text("Tính năng nổi bật")')).toBeVisible();
    await expect(page.locator('.grid')).toBeVisible();
  });

  test('should show drag and drop visual feedback', async ({ page }) => {
    const uploadArea = page.locator('#uploadArea');
    
    // Should not have dragover class initially
    await expect(uploadArea).not.toHaveClass(/dragover/);
    
    // Simulate drag over event
    await uploadArea.dispatchEvent('dragover');
    
    // Should add dragover class for visual feedback
    await expect(uploadArea).toHaveClass(/dragover/);
    
    // Simulate drag leave
    await uploadArea.dispatchEvent('dragleave');
    
    // Should remove dragover class
    await expect(uploadArea).not.toHaveClass(/dragover/);
  });

  test('should display features grid correctly', async ({ page }) => {
    const features = [
      {
        icon: 'fas fa-eye',
        title: 'Phân tích hình ảnh AI',
        description: 'Công nghệ Computer Vision tiên tiến nhận diện và phân tích sản phẩm từ hình ảnh'
      },
      {
        icon: 'fas fa-language',
        title: 'Tạo nội dung tự động',
        description: 'AI tạo mô tả sản phẩm, tiêu đề và từ khóa phù hợp với văn hóa Việt Nam'
      },
      {
        icon: 'fas fa-chart-line',
        title: 'Tối ưu SEO & Trending',
        description: 'Gợi ý từ khóa trending và tối ưu SEO cho các sàn thương mại điện tử'
      }
    ];

    for (const feature of features) {
      await expect(page.locator(`i.${feature.icon.replace(' ', '.')}`)).toBeVisible();
      await expect(page.locator(`h3:has-text("${feature.title}")`)).toBeVisible();
      await expect(page.locator(`p:has-text("${feature.description.substring(0, 20)}")`)).toBeVisible();
    }
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigation should still be visible and properly laid out
    await expect(page.locator('nav')).toBeVisible();
    
    // Upload area should be responsive
    await expect(page.locator('#uploadArea')).toBeVisible();
    
    // Features grid should stack on mobile
    const featuresGrid = page.locator('.grid.grid-cols-1.md\\:grid-cols-3');
    await expect(featuresGrid).toBeVisible();
    
    // Text should remain readable
    await expect(page.locator('h2')).toBeVisible();
    await expect(page.locator('p')).toBeVisible();
  });

  test('should handle keyboard navigation', async ({ page }) => {
    // Tab to login button
    await page.keyboard.press('Tab');
    await expect(page.locator('#loginBtn')).toBeFocused();
    
    // Tab to register button
    await page.keyboard.press('Tab');
    await expect(page.locator('#registerBtn')).toBeFocused();
    
    // Enter should open register modal
    await page.keyboard.press('Enter');
    await expect(page.locator('#registerModal')).toBeVisible();
    
    // Escape should close modal
    await page.keyboard.press('Escape');
    await expect(page.locator('#registerModal')).not.toBeVisible();
  });

  test('should display loading states correctly', async ({ page }) => {
    // Login first
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
    await page.waitForSelector('#registerBtn:has-text("Xin chào, Test User")');

    // Mock slow upload response
    await page.route('**/api/products/upload', (route) => {
      // Delay the response to show loading state
      setTimeout(() => {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { productId: '507f1f77bcf86cd799439012', status: 'processing' }
          })
        });
      }, 2000);
    });

    // Upload file
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('#uploadArea');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from('test', 'base64')
    });

    // Should show upload progress immediately
    await expect(page.locator('#uploadProgress')).toBeVisible();
    await expect(page.locator('#uploadProgress i.fa-spinner.fa-spin')).toBeVisible();
    await expect(page.locator('#progressBar')).toBeVisible();
    
    // Upload content should be hidden
    await expect(page.locator('#uploadContent')).not.toBeVisible();
  });

  test('should display notifications correctly', async ({ page }) => {
    // Create a custom function to show notification for testing
    await page.evaluate(() => {
      window.showNotification('Test notification message', 'success');
    });

    // Should display notification
    await expect(page.locator('.fixed.top-4.right-4')).toBeVisible();
    await expect(page.locator('.fixed.top-4.right-4')).toContainText('Test notification message');
    await expect(page.locator('.fixed.top-4.right-4 i.fa-check-circle')).toBeVisible();
  });

  test('should handle form validation visually', async ({ page }) => {
    await page.click('#registerBtn');
    
    // Try to submit empty form
    await page.click('#registerForm button[type="submit"]');
    
    // Required fields should show HTML5 validation styling
    await expect(page.locator('#registerName')).toHaveAttribute('required');
    await expect(page.locator('#registerEmail')).toHaveAttribute('required');
    await expect(page.locator('#registerPassword')).toHaveAttribute('required');
  });

  test('should maintain UI consistency across different screen sizes', async ({ page }) => {
    const sizes = [
      { width: 1920, height: 1080 }, // Desktop
      { width: 1024, height: 768 },  // Tablet
      { width: 375, height: 667 }    // Mobile
    ];

    for (const size of sizes) {
      await page.setViewportSize(size);
      
      // All main elements should remain visible
      await expect(page.locator('nav')).toBeVisible();
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('#uploadArea')).toBeVisible();
      await expect(page.locator('#loginBtn')).toBeVisible();
      await expect(page.locator('#registerBtn')).toBeVisible();
      
      // No horizontal scrollbars should appear
      const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const windowInnerWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyScrollWidth).toBeLessThanOrEqual(windowInnerWidth + 1); // +1 for potential rounding
    }
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Login first
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
            user: { id: '1', name: 'Test User' },
            token: 'mock-token'
          }
        })
      });
    });
    
    await page.click('#loginForm button[type="submit"]');
    await page.waitForSelector('#registerBtn:has-text("Xin chào, Test User")');

    // Mock error response for upload
    await page.route('**/api/products/upload', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Server error occurred'
        })
      });
    });

    // Try to upload
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('#uploadArea');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from('test', 'base64')
    });

    // Should show error notification
    await expect(page.locator('.fixed.top-4.right-4.bg-red-600')).toBeVisible();
    
    // Upload area should return to normal state
    await expect(page.locator('#uploadContent')).toBeVisible();
    await expect(page.locator('#uploadProgress')).not.toBeVisible();
  });
});