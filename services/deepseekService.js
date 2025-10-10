const axios = require('axios');

class DeepseekService {
    constructor() {
        this.apiKey = process.env.DEEPSEEK_API_KEY;
        this.apiBase = process.env.DEEPSEEK_API_BASE;
        this.client = axios.create({
            baseURL: this.apiBase,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
    }

    async analyzeImage(imageBase64, productType = null) {
        try {
            const prompt = `Analyze this product image and provide detailed information in Vietnamese. 
            ${productType ? `This is a ${productType} product.` : ''}
            
            Please identify:
            1. Product type and category
            2. Visual quality and freshness (for agricultural products)
            3. Key visual features and selling points
            4. Suitable target audience
            5. Estimated quality score (0-10)
            
            Respond in JSON format with the following structure:
            {
                "category": "primary category",
                "subcategory": "secondary category if applicable",
                "features": ["feature1", "feature2", "feature3"],
                "quality": {
                    "score": 8.5,
                    "freshness": "excellent|good|fair|poor",
                    "visualAppeal": 9.0,
                    "notes": "detailed quality assessment"
                },
                "targetAudience": ["audience1", "audience2"],
                "sellingPoints": ["point1", "point2", "point3"],
                "confidence": 0.95
            }`;

            const response = await this.client.post('/chat/completions', {
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: prompt
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${imageBase64}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 1000,
                temperature: 0.3
            });

            const content = response.data.choices[0].message.content;
            return this.parseJsonResponse(content);

        } catch (error) {
            console.error('Deepseek image analysis error:', error.response?.data || error.message);
            throw new Error('Failed to analyze image with Deepseek AI');
        }
    }

    async generateProductDescription(analysisData, options = {}) {
        try {
            const {
                tone = 'professional',
                length = 'medium',
                platform = 'general',
                includeSpecs = true
            } = options;

            const prompt = `Dựa trên thông tin phân tích sản phẩm sau, hãy tạo mô tả sản phẩm tiếng Việt phù hợp cho thương mại điện tử:

            Thông tin sản phẩm:
            - Loại: ${analysisData.category}
            - Đặc điểm: ${analysisData.features?.join(', ')}
            - Điểm bán hàng: ${analysisData.sellingPoints?.join(', ')}
            - Chất lượng: ${analysisData.quality?.notes}

            Yêu cầu:
            - Tone: ${tone} (professional/casual/trendy/premium)
            - Độ dài: ${length} (short: 50-100 từ, medium: 100-200 từ, long: 200-300 từ)
            - Nền tảng: ${platform}
            - Bao gồm thông số kỹ thuật: ${includeSpecs}

            Hãy tạo:
            1. 3 tiêu đề khác nhau (ngắn, trung bình, dài)
            2. Mô tả chi tiết
            3. Từ khóa SEO
            4. Từ khóa trending phù hợp

            Trả về định dạng JSON:
            {
                "titles": [
                    {"text": "tiêu đề ngắn", "length": "short"},
                    {"text": "tiêu đề trung bình", "length": "medium"},
                    {"text": "tiêu đề dài", "length": "long"}
                ],
                "description": "mô tả chi tiết sản phẩm",
                "keywords": {
                    "primary": ["từ khóa chính"],
                    "seo": ["từ khóa SEO"],
                    "trending": ["từ khóa trending"]
                },
                "specifications": {
                    "weight": "trọng lượng",
                    "origin": "xuất xứ",
                    "season": "mùa vụ",
                    "shelfLife": "hạn sử dụng"
                }
            }`;

            const response = await this.client.post('/chat/completions', {
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: 'Bạn là chuyên gia marketing thương mại điện tử Việt Nam, chuyên tạo nội dung bán hàng hấp dẫn và SEO-friendly.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 2000,
                temperature: 0.7
            });

            const content = response.data.choices[0].message.content;
            return this.parseJsonResponse(content);

        } catch (error) {
            console.error('Deepseek description generation error:', error.response?.data || error.message);
            throw new Error('Failed to generate product description');
        }
    }

    async generateTrendingKeywords(category, season = null) {
        try {
            const prompt = `Tạo danh sách từ khóa trending cho sản phẩm ${category} trong thương mại điện tử Việt Nam.
            ${season ? `Mùa: ${season}` : ''}
            
            Hãy tạo:
            1. Từ khóa trending hiện tại
            2. Từ khóa theo mùa (nếu có)
            3. Từ khóa địa phương Việt Nam
            4. Từ khóa theo xu hướng tiêu dùng

            Trả về JSON:
            {
                "trending": ["từ khóa trending"],
                "seasonal": ["từ khóa theo mùa"],
                "local": ["từ khóa địa phương"],
                "consumer_trends": ["xu hướng tiêu dùng"]
            }`;

            const response = await this.client.post('/chat/completions', {
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: 'Bạn là chuyên gia marketing và SEO cho thị trường Việt Nam.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 800,
                temperature: 0.8
            });

            const content = response.data.choices[0].message.content;
            return this.parseJsonResponse(content);

        } catch (error) {
            console.error('Deepseek keyword generation error:', error.response?.data || error.message);
            throw new Error('Failed to generate trending keywords');
        }
    }

    async suggestPricing(productData, marketData = null) {
        try {
            const prompt = `Dựa trên thông tin sản phẩm và thị trường, hãy đề xuất giá bán phù hợp:

            Sản phẩm: ${productData.category}
            Chất lượng: ${productData.quality?.score}/10
            Đặc điểm: ${productData.features?.join(', ')}
            
            ${marketData ? `Dữ liệu thị trường: ${JSON.stringify(marketData)}` : ''}

            Hãy đề xuất:
            1. Khoảng giá phù hợp (VND)
            2. So sánh với thị trường
            3. Chiến lược định giá
            4. Lời khuyên về giá

            Trả về JSON:
            {
                "suggestedRange": {
                    "min": 50000,
                    "max": 150000,
                    "currency": "VND"
                },
                "strategy": "premium|competitive|value",
                "reasoning": "lý do định giá",
                "marketPosition": "vị trí trên thị trường",
                "recommendations": ["lời khuyên 1", "lời khuyên 2"]
            }`;

            const response = await this.client.post('/chat/completions', {
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: 'Bạn là chuyên gia định giá sản phẩm cho thị trường Việt Nam.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 1000,
                temperature: 0.5
            });

            const content = response.data.choices[0].message.content;
            return this.parseJsonResponse(content);

        } catch (error) {
            console.error('Deepseek pricing suggestion error:', error.response?.data || error.message);
            throw new Error('Failed to suggest pricing');
        }
    }

    parseJsonResponse(content) {
        try {
            // Try to extract JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            // If no JSON found, try to parse the entire content
            return JSON.parse(content);
        } catch (error) {
            console.error('Failed to parse JSON response:', content);
            throw new Error('Invalid JSON response from AI');
        }
    }

    async checkHealth() {
        try {
            const response = await this.client.get('/models');
            return { status: 'healthy', models: response.data };
        } catch (error) {
            console.error('Deepseek health check failed:', error.message);
            return { status: 'unhealthy', error: error.message };
        }
    }
}

module.exports = new DeepseekService();