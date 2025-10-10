const express = require('express');
const Product = require('../models/Product');
const User = require('../models/User');

const router = express.Router();

// Middleware to verify webhook authenticity (basic implementation)
const verifyWebhook = (req, res, next) => {
    const webhookSecret = process.env.N8N_API_KEY;
    const receivedSignature = req.headers['x-webhook-signature'];

    if (webhookSecret && receivedSignature) {
        // In production, implement proper signature verification
        // For now, just check if the API key is present
        if (req.headers.authorization !== `Bearer ${webhookSecret}`) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized webhook'
            });
        }
    }

    next();
};

// @desc    Handle n8n product processing completion
// @route   POST /api/webhooks/product-completed
// @access  Webhook
router.post('/product-completed', verifyWebhook, async (req, res) => {
    try {
        const { productId, results, status, error } = req.body;

        if (!productId) {
            return res.status(400).json({
                success: false,
                error: 'Product ID is required'
            });
        }

        const updateData = {
            'metadata.lastUpdated': new Date()
        };

        if (status === 'completed' && results) {
            updateData.status = 'completed';
            
            if (results.description) {
                updateData['description.generated'] = results.description;
                updateData['description.final'] = results.description;
            }

            if (results.keywords) {
                updateData.keywords = results.keywords;
            }

            if (results.pricing) {
                updateData['pricing.suggestedRange'] = results.pricing;
            }

            if (results.marketingInsights) {
                updateData.marketingInsights = results.marketingInsights;
            }

        } else if (status === 'error') {
            updateData.status = 'error';
            if (error) {
                updateData['metadata.errorMessage'] = error;
            }
        }

        await Product.findByIdAndUpdate(productId, { $set: updateData });

        res.json({
            success: true,
            message: 'Product status updated',
            productId
        });

    } catch (error) {
        console.error('Product completion webhook error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process webhook'
        });
    }
});

// @desc    Handle trending keywords update
// @route   POST /api/webhooks/trending-keywords-updated
// @access  Webhook
router.post('/trending-keywords-updated', verifyWebhook, async (req, res) => {
    try {
        const { category, keywords, trends, market = 'vietnam' } = req.body;

        if (!category || !keywords) {
            return res.status(400).json({
                success: false,
                error: 'Category and keywords are required'
            });
        }

        console.log(`Trending keywords updated for ${category}:`, keywords);

        // Store trending keywords in cache or database for later use
        // This is a simple implementation - in production you might want to use Redis
        global.trendingKeywordsCache = global.trendingKeywordsCache || {};
        global.trendingKeywordsCache[category] = {
            keywords,
            trends,
            market,
            updatedAt: new Date()
        };

        res.json({
            success: true,
            message: 'Trending keywords updated',
            category,
            keywordCount: keywords.length
        });

    } catch (error) {
        console.error('Trending keywords webhook error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process webhook'
        });
    }
});

// @desc    Handle competition analysis completion
// @route   POST /api/webhooks/competition-analysis-completed
// @access  Webhook
router.post('/competition-analysis-completed', verifyWebhook, async (req, res) => {
    try {
        const { productId, analysisId, competitors, insights } = req.body;

        if (!productId && !analysisId) {
            return res.status(400).json({
                success: false,
                error: 'Product ID or Analysis ID is required'
            });
        }

        if (productId) {
            // Update specific product with competition data
            await Product.findByIdAndUpdate(productId, {
                $set: {
                    'marketingInsights.competitorData': competitors || [],
                    'marketingInsights.competitiveInsights': insights || {},
                    'metadata.lastUpdated': new Date()
                }
            });
        }

        // Store general competition data for category-level insights
        if (insights && insights.category) {
            global.competitionCache = global.competitionCache || {};
            global.competitionCache[insights.category] = {
                competitors: competitors || [],
                insights: insights,
                updatedAt: new Date()
            };
        }

        res.json({
            success: true,
            message: 'Competition analysis processed',
            productId,
            analysisId,
            competitorCount: competitors ? competitors.length : 0
        });

    } catch (error) {
        console.error('Competition analysis webhook error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process webhook'
        });
    }
});

// @desc    Handle marketplace sync status
// @route   POST /api/webhooks/marketplace-sync-status
// @access  Webhook
router.post('/marketplace-sync-status', verifyWebhook, async (req, res) => {
    try {
        const { productId, platform, status, syncId, productUrl, error } = req.body;

        if (!productId || !platform) {
            return res.status(400).json({
                success: false,
                error: 'Product ID and platform are required'
            });
        }

        const updateData = {
            'metadata.lastUpdated': new Date()
        };

        // Update marketplace sync status
        updateData[`marketingInsights.marketplaceSyncs`] = {
            platform,
            status,
            syncId,
            productUrl,
            error,
            updatedAt: new Date()
        };

        await Product.findByIdAndUpdate(productId, {
            $push: updateData
        });

        res.json({
            success: true,
            message: 'Marketplace sync status updated',
            productId,
            platform,
            status
        });

    } catch (error) {
        console.error('Marketplace sync webhook error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process webhook'
        });
    }
});

// @desc    Handle social media content generation completion
// @route   POST /api/webhooks/social-media-content-completed
// @access  Webhook
router.post('/social-media-content-completed', verifyWebhook, async (req, res) => {
    try {
        const { productId, contentId, generatedContent, platforms } = req.body;

        if (!productId || !generatedContent) {
            return res.status(400).json({
                success: false,
                error: 'Product ID and generated content are required'
            });
        }

        // Store social media content
        await Product.findByIdAndUpdate(productId, {
            $set: {
                'marketingInsights.socialMediaContent': {
                    contentId,
                    content: generatedContent,
                    platforms: platforms || [],
                    generatedAt: new Date()
                },
                'metadata.lastUpdated': new Date()
            }
        });

        res.json({
            success: true,
            message: 'Social media content stored',
            productId,
            contentId,
            platformCount: platforms ? platforms.length : 0
        });

    } catch (error) {
        console.error('Social media content webhook error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process webhook'
        });
    }
});

// @desc    Handle user notification
// @route   POST /api/webhooks/user-notification
// @access  Webhook
router.post('/user-notification', verifyWebhook, async (req, res) => {
    try {
        const { userId, type, message, data } = req.body;

        if (!userId || !type || !message) {
            return res.status(400).json({
                success: false,
                error: 'User ID, type, and message are required'
            });
        }

        console.log(`Notification for user ${userId} (${type}):`, message);

        // In a real application, you would:
        // 1. Store the notification in the database
        // 2. Send real-time notification via WebSocket/SSE
        // 3. Send email/push notification if configured

        res.json({
            success: true,
            message: 'Notification processed',
            userId,
            type
        });

    } catch (error) {
        console.error('User notification webhook error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process webhook'
        });
    }
});

// @desc    Health check for webhooks
// @route   GET /api/webhooks/health
// @access  Webhook
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        webhooks: [
            'product-completed',
            'trending-keywords-updated', 
            'competition-analysis-completed',
            'marketplace-sync-status',
            'social-media-content-completed',
            'user-notification'
        ]
    });
});

// @desc    Get cached trending keywords
// @route   GET /api/webhooks/cached-trending/:category
// @access  Webhook
router.get('/cached-trending/:category', (req, res) => {
    try {
        const { category } = req.params;
        const cache = global.trendingKeywordsCache || {};
        
        if (cache[category]) {
            res.json({
                success: true,
                data: cache[category]
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'No cached data found for this category'
            });
        }

    } catch (error) {
        console.error('Cached trending keywords error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve cached data'
        });
    }
});

// @desc    Get cached competition data
// @route   GET /api/webhooks/cached-competition/:category
// @access  Webhook
router.get('/cached-competition/:category', (req, res) => {
    try {
        const { category } = req.params;
        const cache = global.competitionCache || {};
        
        if (cache[category]) {
            res.json({
                success: true,
                data: cache[category]
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'No cached competition data found for this category'
            });
        }

    } catch (error) {
        console.error('Cached competition data error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve cached data'
        });
    }
});

module.exports = router;