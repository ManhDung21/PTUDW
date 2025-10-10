const axios = require('axios');

class N8nService {
    constructor() {
        this.webhookUrl = process.env.N8N_WEBHOOK_URL;
        this.apiKey = process.env.N8N_API_KEY;
        this.client = axios.create({
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
                ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
            }
        });
    }

    async triggerProductProcessing(productData) {
        try {
            const payload = {
                event: 'product_processing',
                timestamp: new Date().toISOString(),
                data: {
                    productId: productData._id || productData.id,
                    name: productData.name,
                    category: productData.category,
                    imageUrl: productData.originalImage,
                    userId: productData.user,
                    status: 'processing'
                }
            };

            const response = await this.client.post(`${this.webhookUrl}/product-processing`, payload);
            
            console.log('N8n product processing triggered:', response.data);
            return {
                success: true,
                workflowId: response.data?.workflowId,
                executionId: response.data?.executionId
            };

        } catch (error) {
            console.error('N8n product processing trigger failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async notifyProductCompleted(productData, results) {
        try {
            const payload = {
                event: 'product_completed',
                timestamp: new Date().toISOString(),
                data: {
                    productId: productData._id || productData.id,
                    name: productData.name,
                    category: productData.category,
                    description: results.description,
                    keywords: results.keywords,
                    userId: productData.user,
                    status: 'completed',
                    processingTime: results.processingTime,
                    confidence: results.aiAnalysis?.confidence
                }
            };

            const response = await this.client.post(`${this.webhookUrl}/product-completed`, payload);
            
            console.log('N8n product completion notified:', response.data);
            return {
                success: true,
                notificationId: response.data?.notificationId
            };

        } catch (error) {
            console.error('N8n product completion notification failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async sendEmailNotification(userId, template, data) {
        try {
            const payload = {
                event: 'email_notification',
                timestamp: new Date().toISOString(),
                data: {
                    userId: userId,
                    template: template,
                    templateData: data,
                    priority: 'normal'
                }
            };

            const response = await this.client.post(`${this.webhookUrl}/email-notification`, payload);
            
            console.log('N8n email notification sent:', response.data);
            return {
                success: true,
                messageId: response.data?.messageId
            };

        } catch (error) {
            console.error('N8n email notification failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async syncWithMarketplace(productData, platform) {
        try {
            const payload = {
                event: 'marketplace_sync',
                timestamp: new Date().toISOString(),
                data: {
                    productId: productData._id || productData.id,
                    platform: platform, // 'shopee', 'lazada', 'tiki', etc.
                    productData: {
                        name: productData.name,
                        description: productData.description.final,
                        category: productData.category,
                        images: [productData.originalImage, ...productData.processedImages],
                        keywords: productData.keywords,
                        pricing: productData.pricing
                    },
                    userId: productData.user
                }
            };

            const response = await this.client.post(`${this.webhookUrl}/marketplace-sync`, payload);
            
            console.log(`N8n marketplace sync (${platform}) triggered:`, response.data);
            return {
                success: true,
                syncId: response.data?.syncId,
                platform: platform
            };

        } catch (error) {
            console.error(`N8n marketplace sync (${platform}) failed:`, error.response?.data || error.message);
            return {
                success: false,
                error: error.message,
                platform: platform
            };
        }
    }

    async fetchTrendingKeywords(category) {
        try {
            const payload = {
                event: 'fetch_trending_keywords',
                timestamp: new Date().toISOString(),
                data: {
                    category: category,
                    market: 'vietnam',
                    sources: ['google_trends', 'marketplace_data', 'social_media']
                }
            };

            const response = await this.client.post(`${this.webhookUrl}/trending-keywords`, payload);
            
            console.log('N8n trending keywords fetched:', response.data);
            return {
                success: true,
                keywords: response.data?.keywords || [],
                trends: response.data?.trends || []
            };

        } catch (error) {
            console.error('N8n trending keywords fetch failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.message,
                keywords: [],
                trends: []
            };
        }
    }

    async analyzeCompetition(productData) {
        try {
            const payload = {
                event: 'competition_analysis',
                timestamp: new Date().toISOString(),
                data: {
                    productName: productData.name,
                    category: productData.category,
                    keywords: productData.keywords?.primary || [],
                    platforms: ['shopee', 'lazada', 'tiki', 'sendo']
                }
            };

            const response = await this.client.post(`${this.webhookUrl}/competition-analysis`, payload);
            
            console.log('N8n competition analysis triggered:', response.data);
            return {
                success: true,
                analysisId: response.data?.analysisId,
                competitorData: response.data?.competitors || []
            };

        } catch (error) {
            console.error('N8n competition analysis failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.message,
                competitorData: []
            };
        }
    }

    async generateSocialMediaContent(productData) {
        try {
            const payload = {
                event: 'social_media_content',
                timestamp: new Date().toISOString(),
                data: {
                    productId: productData._id || productData.id,
                    productName: productData.name,
                    description: productData.description.final,
                    imageUrl: productData.originalImage,
                    keywords: productData.keywords,
                    platforms: ['facebook', 'instagram', 'tiktok', 'zalo'],
                    contentTypes: ['post', 'story', 'reel', 'ad_copy']
                }
            };

            const response = await this.client.post(`${this.webhookUrl}/social-media-content`, payload);
            
            console.log('N8n social media content generation triggered:', response.data);
            return {
                success: true,
                contentId: response.data?.contentId,
                generatedContent: response.data?.content || {}
            };

        } catch (error) {
            console.error('N8n social media content generation failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.message,
                generatedContent: {}
            };
        }
    }

    async checkWorkflowStatus(workflowId, executionId) {
        try {
            const response = await this.client.get(`${this.webhookUrl}/status/${workflowId}/${executionId}`);
            
            return {
                success: true,
                status: response.data?.status || 'unknown',
                progress: response.data?.progress || 0,
                result: response.data?.result
            };

        } catch (error) {
            console.error('N8n workflow status check failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.message,
                status: 'error'
            };
        }
    }

    async checkHealth() {
        try {
            const response = await this.client.get(`${this.webhookUrl}/health`);
            return { 
                status: 'healthy', 
                version: response.data?.version,
                uptime: response.data?.uptime 
            };
        } catch (error) {
            console.error('N8n health check failed:', error.message);
            return { 
                status: 'unhealthy', 
                error: error.message 
            };
        }
    }
}

module.exports = new N8nService();