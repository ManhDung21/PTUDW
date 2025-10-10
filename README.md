# AI Product Description Generator

## Tổng quan

Ứng dụng AI tạo mô tả sản phẩm tự động cho các sàn thương mại điện tử, đặc biệt tối ưu cho thị trường Việt Nam. Hệ thống sử dụng công nghệ AI tiên tiến để phân tích hình ảnh nông sản và tự động sinh mô tả sản phẩm chuyên nghiệp, từ khóa SEO và gợi ý giá bán.

## Tính năng chính

### 🤖 AI Analysis
- **Computer Vision**: Phân tích hình ảnh sản phẩm tự động
- **Deepseek AI**: Tạo mô tả sản phẩm bằng tiếng Việt
- **Quality Assessment**: Đánh giá chất lượng và độ tươi của nông sản
- **Category Classification**: Phân loại sản phẩm tự động

### 📝 Content Generation
- **Product Descriptions**: Mô tả chi tiết phù hợp với e-commerce
- **SEO Keywords**: Từ khóa tối ưu cho công cụ tìm kiếm
- **Trending Keywords**: Từ khóa trending theo mùa vụ và xu hướng
- **Multiple Titles**: Tiêu đề đa dạng với nhiều tone khác nhau

### 💰 Pricing Intelligence
- **Market Analysis**: Phân tích giá thị trường
- **Price Suggestions**: Gợi ý khoảng giá phù hợp
- **Competition Tracking**: Theo dõi đối thủ cạnh tranh

### 🔄 Automation & Integration
- **n8n Workflows**: Tự động hóa quy trình với n8n
- **Marketplace Sync**: Đồng bộ với Shopee, Lazada, Tiki
- **Social Media**: Tạo nội dung cho Facebook, Instagram, TikTok
- **Real-time Processing**: Xử lý real-time với webhook

## Công nghệ sử dụng

### Backend
- **Node.js + Express**: API server
- **MongoDB**: Database
- **Mongoose**: ODM
- **Deepseek AI**: Text generation và image analysis
- **Sharp**: Image processing
- **JWT**: Authentication

### Frontend
- **HTML5 + CSS3**: Modern web standards
- **Tailwind CSS**: Utility-first CSS framework
- **Vanilla JavaScript**: Lightweight client-side code
- **Font Awesome**: Icons

### AI & Automation
- **Deepseek API**: GPT-like AI model
- **n8n**: Workflow automation
- **Computer Vision**: Image analysis
- **NLP**: Natural language processing

## Cài đặt và Chạy

### Yêu cầu hệ thống
- Node.js >= 18.0.0
- MongoDB >= 5.0
- npm >= 9.0.0

### 1. Clone repository
```bash
git clone <repository-url>
cd ai-product-description-generator
```

### 2. Cài đặt dependencies
```bash
npm install
```

### 3. Cấu hình environment
```bash
cp .env.example .env
```

Chỉnh sửa file `.env` với các thông tin:
```env
# Database
MONGODB_URI=mongodb://localhost:27017/ai-product-description

# Deepseek AI
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# n8n
N8N_WEBHOOK_URL=http://localhost:5678/webhook
N8N_API_KEY=your_n8n_api_key_here

# JWT
JWT_SECRET=your_super_secret_jwt_key_here
```

### 4. Khởi động MongoDB
```bash
# Trên Windows
net start MongoDB

# Trên Linux/Mac
sudo systemctl start mongod
```

### 5. Chạy ứng dụng

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

Ứng dụng sẽ chạy tại: http://localhost:5000

## API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Đăng ký tài khoản
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/me` - Thông tin user hiện tại
- `PUT /api/auth/profile` - Cập nhật profile

### Product Endpoints
- `POST /api/products/upload` - Upload và phân tích sản phẩm
- `GET /api/products` - Danh sách sản phẩm
- `GET /api/products/:id` - Chi tiết sản phẩm
- `PUT /api/products/:id` - Cập nhật sản phẩm
- `DELETE /api/products/:id` - Xóa sản phẩm

### AI Endpoints
- `GET /api/ai/health` - Kiểm tra trạng thái AI services
- `POST /api/ai/generate-titles` - Tạo tiêu đề sản phẩm
- `POST /api/ai/generate-keywords` - Tạo từ khóa
- `POST /api/ai/analyze-competition` - Phân tích đối thủ

### Webhook Endpoints
- `POST /api/webhooks/product-completed` - n8n completion webhook
- `POST /api/webhooks/trending-keywords-updated` - Trending keywords update
- `GET /api/webhooks/health` - Webhook health check

## Database Schema

### User Model
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: String (user/admin),
  businessType: String (farmer/retailer/marketplace/other),
  isActive: Boolean
}
```

### Product Model
```javascript
{
  name: String,
  originalImage: String,
  processedImages: Array,
  category: {
    primary: String,
    secondary: String,
    tags: Array
  },
  description: {
    generated: String,
    edited: String,
    final: String
  },
  keywords: {
    primary: Array,
    trending: Array,
    seo: Array
  },
  pricing: {
    suggestedRange: { min: Number, max: Number }
  },
  aiAnalysis: {
    confidence: Number,
    qualityScore: Number,
    freshness: String
  },
  status: String (draft/processing/completed/error)
}
```

## Testing

### Unit Tests
```bash
npm test
```

### E2E Tests với Playwright
```bash
npm run test:e2e
```

### API Testing
```bash
# Sử dụng curl hoặc Postman
curl -X GET http://localhost:5000/api/health
```

## Deployment

### Docker
```bash
# Build image
docker build -t ai-product-description .

# Run container
docker run -p 5000:5000 -e NODE_ENV=production ai-product-description
```

### Production Environment
1. Setup MongoDB cluster
2. Configure reverse proxy (Nginx)
3. Setup SSL certificates
4. Configure environment variables
5. Setup monitoring và logging

## n8n Workflow Configuration

### 1. Cài đặt n8n
```bash
npm install -g n8n
n8n start
```

### 2. Import workflows
- Truy cập n8n interface: http://localhost:5678
- Import các workflow từ thư mục `n8n-workflows/`

### 3. Configure webhooks
- Product Processing Workflow
- Trending Keywords Fetcher
- Marketplace Sync
- Social Media Content Generator

## Contributing

1. Fork repository
2. Tạo feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push branch: `git push origin feature/amazing-feature`
5. Tạo Pull Request

## License

MIT License - xem file [LICENSE](LICENSE) để biết thêm chi tiết.

## Support

- **Email**: support@ai-product-description.com
- **Documentation**: https://docs.ai-product-description.com
- **Issues**: GitHub Issues
- **Community**: Discord Server

## Roadmap

### Phase 1 (Current)
- [x] Basic image upload và analysis
- [x] Deepseek AI integration
- [x] Product description generation
- [x] Basic web interface

### Phase 2 (Next)
- [ ] Mobile application
- [ ] Advanced image editing
- [ ] Bulk processing
- [ ] Analytics dashboard

### Phase 3 (Future)  
- [ ] Machine learning improvements
- [ ] Multiple language support
- [ ] Advanced marketplace integrations
- [ ] Enterprise features

## FAQ

**Q: Tôi cần API key nào để sử dụng?**
A: Bạn cần Deepseek API key và tùy chọn n8n setup cho automation.

**Q: Hỗ trợ những định dạng ảnh nào?**
A: JPG, PNG, WebP với dung lượng tối đa 10MB.

**Q: Có thể sử dụng offline không?**
A: Không, ứng dụng cần kết nối internet để sử dụng Deepseek AI.

**Q: Có giới hạn số lượng sản phẩm không?**
A: Phụ thuộc vào plan sử dụng và API limits của Deepseek.