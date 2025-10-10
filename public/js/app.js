// Global state
let currentUser = null;
let currentProduct = null;

// API base URL
const API_BASE = window.location.origin + '/api';

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    checkAuthStatus();
});

// Event listeners
function initializeEventListeners() {
    // File upload
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);

    // Modal controls
    document.getElementById('loginBtn').addEventListener('click', showLoginModal);
    document.getElementById('registerBtn').addEventListener('click', showRegisterModal);
    document.getElementById('closeLoginModal').addEventListener('click', hideLoginModal);
    document.getElementById('closeRegisterModal').addEventListener('click', hideRegisterModal);

    // Forms
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);

    // Result actions
    document.getElementById('copyDescription').addEventListener('click', copyDescription);
    document.getElementById('editDescription').addEventListener('click', editDescription);
    document.getElementById('downloadResults').addEventListener('click', downloadResults);
}

// Auth functions
function checkAuthStatus() {
    const token = localStorage.getItem('token');
    if (token) {
        fetch(`${API_BASE}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                currentUser = data.data.user;
                updateUIForLoggedInUser();
            } else {
                localStorage.removeItem('token');
            }
        })
        .catch(() => localStorage.removeItem('token'));
    }
}

function updateUIForLoggedInUser() {
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('registerBtn').textContent = `Xin chào, ${currentUser.name}`;
    document.getElementById('registerBtn').onclick = logout;
    document.getElementById('registerBtn').className = 'bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition';
}

function logout() {
    localStorage.removeItem('token');
    currentUser = null;
    location.reload();
}

// Modal functions
function showLoginModal() {
    document.getElementById('loginModal').classList.remove('hidden');
    document.getElementById('loginModal').classList.add('flex');
}

function hideLoginModal() {
    document.getElementById('loginModal').classList.add('hidden');
    document.getElementById('loginModal').classList.remove('flex');
}

function showRegisterModal() {
    document.getElementById('registerModal').classList.remove('hidden');
    document.getElementById('registerModal').classList.add('flex');
}

function hideRegisterModal() {
    document.getElementById('registerModal').classList.add('hidden');
    document.getElementById('registerModal').classList.remove('flex');
}

// Auth handlers
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('token', data.data.token);
            currentUser = data.data.user;
            hideLoginModal();
            updateUIForLoggedInUser();
            showNotification('Đăng nhập thành công!', 'success');
        } else {
            showNotification(data.error || 'Đăng nhập thất bại', 'error');
        }
    } catch (error) {
        showNotification('Lỗi kết nối', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const businessType = document.getElementById('businessType').value;

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password, businessType })
        });

        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('token', data.data.token);
            currentUser = data.data.user;
            hideRegisterModal();
            updateUIForLoggedInUser();
            showNotification('Đăng ký thành công!', 'success');
        } else {
            showNotification(data.error || 'Đăng ký thất bại', 'error');
        }
    } catch (error) {
        showNotification('Lỗi kết nối', 'error');
    }
}

// File upload handlers
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        processFile(e.target.files[0]);
    }
}

async function processFile(file) {
    // Validate file
    if (!file.type.startsWith('image/')) {
        showNotification('Vui lòng chọn file hình ảnh', 'error');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showNotification('File không được vượt quá 10MB', 'error');
        return;
    }

    // Check authentication
    if (!currentUser) {
        showNotification('Vui lòng đăng nhập để sử dụng tính năng này', 'warning');
        showLoginModal();
        return;
    }

    // Show upload progress
    showUploadProgress();

    // Prepare form data
    const formData = new FormData();
    formData.append('image', file);
    formData.append('name', document.getElementById('productName').value || `Product ${Date.now()}`);
    formData.append('category', document.getElementById('productCategory').value || 'other');

    try {
        const response = await fetch(`${API_BASE}/products/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });

        const data = await response.json();
        
        if (data.success) {
            currentProduct = data.data;
            showResults(file);
            pollProductStatus(data.data.productId);
            showNotification('Tải lên thành công! AI đang phân tích...', 'success');
        } else {
            showNotification(data.error || 'Tải lên thất bại', 'error');
            hideUploadProgress();
        }
    } catch (error) {
        showNotification('Lỗi kết nối', 'error');
        hideUploadProgress();
    }
}

function showUploadProgress() {
    document.getElementById('uploadContent').classList.add('hidden');
    document.getElementById('uploadProgress').classList.remove('hidden');
    
    // Simulate progress
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 10;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
        }
        document.getElementById('progressBar').style.width = `${progress}%`;
    }, 200);
}

function hideUploadProgress() {
    document.getElementById('uploadContent').classList.remove('hidden');
    document.getElementById('uploadProgress').classList.add('hidden');
    document.getElementById('progressBar').style.width = '0%';
}

function showResults(file) {
    // Show preview image
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('previewImage').src = e.target.result;
    };
    reader.readAsDataURL(file);

    // Show results section
    document.getElementById('resultsSection').classList.remove('hidden');
    document.getElementById('resultsSection').classList.add('fade-in');

    // Hide upload progress
    hideUploadProgress();
}

async function pollProductStatus(productId) {
    const maxAttempts = 30; // 5 minutes max
    let attempts = 0;

    const poll = async () => {
        try {
            const response = await fetch(`${API_BASE}/products/${productId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                const product = data.data;
                updateProductResults(product);

                if (product.status === 'completed') {
                    showNotification('AI đã hoàn thành phân tích sản phẩm!', 'success');
                    return;
                } else if (product.status === 'error') {
                    showNotification('Lỗi trong quá trình phân tích', 'error');
                    return;
                }
            }

            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(poll, 10000); // Poll every 10 seconds
            } else {
                showNotification('Thời gian xử lý quá lâu, vui lòng thử lại', 'warning');
            }
        } catch (error) {
            console.error('Polling error:', error);
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(poll, 10000);
            }
        }
    };

    poll();
}

function updateProductResults(product) {
    currentProduct = product;

    // Update description
    if (product.description && product.description.final) {
        document.getElementById('productDescription').innerHTML = `
            <p class="text-gray-700 whitespace-pre-wrap">${product.description.final}</p>
        `;
    }

    // Update titles
    if (product.titles && product.titles.length > 0) {
        const titlesHtml = product.titles.map((title, index) => `
            <div class="bg-gray-50 p-3 rounded-lg cursor-pointer hover:bg-blue-50 transition" onclick="copyText('${title.text}')">
                <div class="font-medium text-gray-800">${title.text}</div>
                <div class="text-sm text-gray-500 mt-1">
                    ${title.tone} • ${title.length}
                    <i class="fas fa-copy ml-2 text-blue-600"></i>
                </div>
            </div>
        `).join('');
        document.getElementById('productTitles').innerHTML = titlesHtml;
    }

    // Update keywords
    if (product.keywords) {
        let keywordsHtml = '';
        
        if (product.keywords.primary && product.keywords.primary.length > 0) {
            keywordsHtml += `
                <div class="mb-4">
                    <h4 class="font-medium text-gray-700 mb-2">Từ khóa chính:</h4>
                    <div class="flex flex-wrap gap-2">
                        ${product.keywords.primary.map(keyword => 
                            `<span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">${keyword}</span>`
                        ).join('')}
                    </div>
                </div>
            `;
        }

        if (product.keywords.trending && product.keywords.trending.length > 0) {
            keywordsHtml += `
                <div class="mb-4">
                    <h4 class="font-medium text-gray-700 mb-2">Trending:</h4>
                    <div class="flex flex-wrap gap-2">
                        ${product.keywords.trending.map(keyword => 
                            `<span class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">${keyword}</span>`
                        ).join('')}
                    </div>
                </div>
            `;
        }

        if (product.keywords.seo && product.keywords.seo.length > 0) {
            keywordsHtml += `
                <div>
                    <h4 class="font-medium text-gray-700 mb-2">SEO:</h4>
                    <div class="flex flex-wrap gap-2">
                        ${product.keywords.seo.map(keyword => 
                            `<span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">${keyword}</span>`
                        ).join('')}
                    </div>
                </div>
            `;
        }

        document.getElementById('productKeywords').innerHTML = keywordsHtml || '<p class="text-gray-500">Chưa có từ khóa</p>';
    }

    // Update pricing
    if (product.pricing && product.pricing.suggestedRange) {
        const pricing = product.pricing.suggestedRange;
        const formattedMin = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(pricing.min);
        const formattedMax = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(pricing.max);
        
        document.getElementById('pricingSuggestions').innerHTML = `
            <div class="bg-green-50 p-4 rounded-lg">
                <div class="text-2xl font-bold text-green-700 mb-2">
                    ${formattedMin} - ${formattedMax}
                </div>
                <p class="text-sm text-gray-600">Khoảng giá đề xuất dựa trên phân tích thị trường</p>
            </div>
        `;
    }
}

// Action handlers
function copyDescription() {
    const description = document.querySelector('#productDescription p');
    if (description) {
        copyText(description.textContent);
    }
}

function editDescription() {
    const descriptionElement = document.querySelector('#productDescription p');
    if (descriptionElement) {
        const currentText = descriptionElement.textContent;
        const textarea = document.createElement('textarea');
        textarea.className = 'w-full p-3 border border-gray-300 rounded-lg resize-none';
        textarea.rows = 6;
        textarea.value = currentText;
        
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'mt-3 flex space-x-2';
        buttonsDiv.innerHTML = `
            <button onclick="saveDescription('${currentProduct._id}', this)" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">
                <i class="fas fa-save mr-2"></i>Lưu
            </button>
            <button onclick="cancelEdit()" class="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition">
                <i class="fas fa-times mr-2"></i>Hủy
            </button>
        `;
        
        const container = descriptionElement.parentElement;
        container.innerHTML = '';
        container.appendChild(textarea);
        container.appendChild(buttonsDiv);
        
        textarea.focus();
    }
}

async function saveDescription(productId, buttonElement) {
    const textarea = buttonElement.parentElement.previousElementSibling;
    const newDescription = textarea.value;
    
    try {
        const response = await fetch(`${API_BASE}/products/${productId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                'description.edited': newDescription
            })
        });

        const data = await response.json();
        
        if (data.success) {
            document.getElementById('productDescription').innerHTML = `
                <p class="text-gray-700 whitespace-pre-wrap">${newDescription}</p>
            `;
            showNotification('Mô tả đã được cập nhật', 'success');
        } else {
            showNotification(data.error || 'Không thể cập nhật mô tả', 'error');
        }
    } catch (error) {
        showNotification('Lỗi kết nối', 'error');
    }
}

function cancelEdit() {
    if (currentProduct && currentProduct.description) {
        document.getElementById('productDescription').innerHTML = `
            <p class="text-gray-700 whitespace-pre-wrap">${currentProduct.description.final}</p>
        `;
    }
}

function downloadResults() {
    if (!currentProduct) return;
    
    const content = {
        name: currentProduct.name,
        description: currentProduct.description.final,
        titles: currentProduct.titles,
        keywords: currentProduct.keywords,
        pricing: currentProduct.pricing,
        category: currentProduct.category,
        generatedAt: new Date().toISOString()
    };

    const dataStr = JSON.stringify(content, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentProduct.name}_AI_Analysis.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showNotification('Kết quả đã được tải xuống', 'success');
}

// Utility functions
function copyText(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Đã sao chép vào clipboard', 'success');
        });
    } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('Đã sao chép vào clipboard', 'success');
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg text-white max-w-sm transform translate-x-full transition-transform duration-300 ${
        type === 'success' ? 'bg-green-600' :
        type === 'error' ? 'bg-red-600' :
        type === 'warning' ? 'bg-yellow-600' :
        'bg-blue-600'
    }`;
    
    notification.innerHTML = `
        <div class="flex items-center space-x-2">
            <i class="fas ${
                type === 'success' ? 'fa-check-circle' :
                type === 'error' ? 'fa-exclamation-circle' :
                type === 'warning' ? 'fa-exclamation-triangle' :
                'fa-info-circle'
            }"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(full)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 5000);
}