const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Product Upload and Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
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
    await page.waitForSelector('#registerBtn:has-text("Xin chào, Test User")');
  });

  test('should display upload area and form fields', async ({ page }) => {
    await expect(page.locator('#uploadArea')).toBeVisible();
    await expect(page.locator('#fileInput')).toBeVisible();
    await expect(page.locator('#productName')).toBeVisible();
    await expect(page.locator('#productCategory')).toBeVisible();
    
    // Check upload area content
    await expect(page.locator('#uploadArea')).toContainText('Kéo thả hình ảnh vào đây hoặc nhấp để chọn');
    await expect(page.locator('#uploadArea')).toContainText('Hỗ trợ: JPG, PNG, WebP (tối đa 10MB)');
  });

  test('should open file picker when upload area is clicked', async ({ page }) => {
    // Create a file chooser promise before clicking
    const fileChooserPromise = page.waitForEvent('filechooser');
    
    await page.click('#uploadArea');
    
    const fileChooser = await fileChooserPromise;
    expect(fileChooser).toBeTruthy();
  });

  test('should show categories in dropdown', async ({ page }) => {
    await page.click('#productCategory');
    
    const options = [
      'Trái cây', 'Rau củ', 'Ngũ cốc', 'Thảo mộc', 'Gia vị',
      'Sữa và chế phẩm', 'Thịt', 'Hải sản', 'Đồ uống',
      'Thực phẩm chế biến', 'Thực phẩm hữu cơ', 'Hàng nhập khẩu', 'Đặc sản địa phương'
    ];
    
    for (const option of options) {
      await expect(page.locator(`option:has-text("${option}")`)).toBeVisible();
    }
  });

  test('should successfully upload and process image file', async ({ page }) => {
    // Mock the upload API
    await page.route('**/api/products/upload', (route) => {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            productId: '507f1f77bcf86cd799439012',
            status: 'processing',
            imageUrl: '/uploads/test-image.jpg',
            qualityAnalysis: {
              quality: {
                score: 8.5,
                visualAppeal: 9.0
              }
            }
          },
          message: 'Image uploaded successfully. AI analysis is in progress.'
        })
      });
    });

    // Mock the product status polling
    await page.route('**/api/products/507f1f77bcf86cd799439012', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            _id: '507f1f77bcf86cd799439012',
            name: 'Test Product',
            status: 'completed',
            originalImage: '/uploads/test-image.jpg',
            category: {
              primary: 'fruits',
              secondary: 'tropical'
            },
            description: {
              generated: 'Táo Fuji nhập khẩu từ Nhật Bản với chất lượng cao...',
              final: 'Táo Fuji nhập khẩu từ Nhật Bản với chất lượng cao...'
            },
            titles: [
              { text: 'Táo Fuji Nhật Bản - Chất lượng cao', tone: 'professional', length: 'medium' },
              { text: 'Táo Fuji siêu ngon từ Nhật', tone: 'casual', length: 'short' }
            ],
            keywords: {
              primary: ['táo fuji', 'nhật bản', 'trái cây'],
              trending: ['trái cây nhập khẩu', 'táo cao cấp'],
              seo: ['mua táo fuji', 'táo nhật bản giá rẻ']
            },
            pricing: {
              suggestedRange: {
                min: 150000,
                max: 200000,
                currency: 'VND'
              }
            }
          }
        })
      });
    });

    // Fill optional fields
    await page.fill('#productName', 'Táo Fuji Nhật Bản');
    await page.selectOption('#productCategory', 'fruits');

    // Create and upload test file
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('#uploadArea');
    const fileChooser = await fileChooserPromise;

    // Create a test image file (base64 encoded 1x1 pixel image)
    const testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    );
    
    await fileChooser.setFiles({
      name: 'test-apple.png',
      mimeType: 'image/png',
      buffer: testImageBuffer,
    });

    // Should show upload progress
    await expect(page.locator('#uploadProgress')).toBeVisible();
    await expect(page.locator('#uploadProgress')).toContainText('Đang xử lý hình ảnh...');

    // Should show success notification
    await expect(page.locator('.fixed.top-4.right-4')).toContainText('Tải lên thành công!');

    // Should show results section
    await expect(page.locator('#resultsSection')).toBeVisible();
    await expect(page.locator('#previewImage')).toBeVisible();

    // Wait for AI processing to complete
    await page.waitForTimeout(2000);

    // Should show completed results
    await expect(page.locator('#productDescription')).toContainText('Táo Fuji nhập khẩu từ Nhật Bản');
    await expect(page.locator('#productTitles')).toContainText('Táo Fuji Nhật Bản - Chất lượng cao');
    await expect(page.locator('#productKeywords')).toContainText('táo fuji');
    await expect(page.locator('#pricingSuggestions')).toContainText('150.000');
  });

  test('should require login for file upload', async ({ page }) => {
    // Logout first
    await page.click('#registerBtn'); // This is logout button when logged in
    await page.waitForTimeout(1000);

    // Now try to upload without being logged in
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('#uploadArea');
    const fileChooser = await fileChooserPromise;

    const testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    );
    
    await fileChooser.setFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: testImageBuffer,
    });

    // Should show login required notification and open login modal
    await expect(page.locator('.fixed.top-4.right-4')).toContainText('Vui lòng đăng nhập');
    await expect(page.locator('#loginModal')).toBeVisible();
  });

  test('should validate file type', async ({ page }) => {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('#uploadArea');
    const fileChooser = await fileChooserPromise;

    // Try to upload a text file
    await fileChooser.setFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('This is not an image'),
    });

    // Should show error notification
    await expect(page.locator('.fixed.top-4.right-4')).toContainText('Vui lòng chọn file hình ảnh');
  });

  test('should copy description when copy button is clicked', async ({ page }) => {
    // First complete an upload (use the same setup as successful upload test)
    await page.route('**/api/products/upload', (route) => {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { productId: '507f1f77bcf86cd799439012', status: 'processing' }
        })
      });
    });

    await page.route('**/api/products/507f1f77bcf86cd799439012', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            _id: '507f1f77bcf86cd799439012',
            status: 'completed',
            description: { final: 'Test product description for copying' }
          }
        })
      });
    });

    // Upload a file
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('#uploadArea');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from('test', 'base64')
    });

    await page.waitForSelector('#resultsSection');
    await page.waitForTimeout(2000);

    // Click copy button
    await page.click('#copyDescription');

    // Should show copy success notification
    await expect(page.locator('.fixed.top-4.right-4')).toContainText('Đã sao chép vào clipboard');
  });

  test('should allow editing description', async ({ page }) => {
    // Setup similar to copy test
    await page.route('**/api/products/upload', (route) => {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { productId: '507f1f77bcf86cd799439012', status: 'processing' }
        })
      });
    });

    await page.route('**/api/products/507f1f77bcf86cd799439012', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            _id: '507f1f77bcf86cd799439012',
            status: 'completed',
            description: { final: 'Original description text' }
          }
        })
      });
    });

    // Mock the update API
    await page.route('**/api/products/507f1f77bcf86cd799439012', (route) => {
      if (route.request().method() === 'PUT') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      } else {
        route.continue();
      }
    });

    // Upload and wait for completion
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('#uploadArea');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from('test', 'base64')
    });

    await page.waitForSelector('#resultsSection');
    await page.waitForTimeout(2000);

    // Click edit button
    await page.click('#editDescription');

    // Should show textarea
    await expect(page.locator('#productDescription textarea')).toBeVisible();
    await expect(page.locator('button:has-text("Lưu")')).toBeVisible();
    await expect(page.locator('button:has-text("Hủy")')).toBeVisible();

    // Edit the text
    await page.fill('#productDescription textarea', 'Edited description text');

    // Save changes
    await page.click('button:has-text("Lưu")');

    // Should show success notification and return to view mode
    await expect(page.locator('.fixed.top-4.right-4')).toContainText('Mô tả đã được cập nhật');
    await expect(page.locator('#productDescription p')).toContainText('Edited description text');
  });

  test('should download results as JSON', async ({ page }) => {
    // Setup completed product
    await page.route('**/api/products/upload', (route) => {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { productId: '507f1f77bcf86cd799439012', status: 'processing' }
        })
      });
    });

    await page.route('**/api/products/507f1f77bcf86cd799439012', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            _id: '507f1f77bcf86cd799439012',
            name: 'Test Product',
            status: 'completed',
            description: { final: 'Test description' },
            titles: [{ text: 'Test Title', tone: 'professional', length: 'medium' }],
            keywords: { primary: ['test', 'product'] }
          }
        })
      });
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

    await page.waitForSelector('#resultsSection');
    await page.waitForTimeout(2000);

    // Setup download listener
    const downloadPromise = page.waitForEvent('download');

    // Click download button
    await page.click('#downloadResults');

    // Should trigger download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('_AI_Analysis.json');

    // Should show success notification
    await expect(page.locator('.fixed.top-4.right-4')).toContainText('Kết quả đã được tải xuống');
  });
});