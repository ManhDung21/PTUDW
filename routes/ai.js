const express = require('express');
const { protect, optional } = require('../middleware/auth');
const { strictRateLimiter } = require('../middleware/rateLimiter');
const deepseekService = require('../services/deepseekService');
const n8nService = require('../services/n8nService');
const Product = require('../models/Product');

const router = express.Router();

// @desc    Test AI connectivity and models
// @route   GET /api/ai/health
// @access  Public
router.get('/health', async (req, res, next) => {
    try {
        const deepseekHealth = await deepseekService.checkHealth();
        const n8nHealth = await n8nService.checkHealth();

        res.json({
            success: true,
            services: {
                deepseek: deepseekHealth,
                n8n: n8nHealth
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        next(error);
    }
});

// @desc    Generate product title suggestions
// @route   POST /api/ai/generate-titles
// @access  Protected
router.post('/generate-titles', protect, strictRateLimiter, async (req, res, next) => {
    try {
        const { productName, category, features, tone = 'professional' } = req.body;

        if (!productName || !category) {
            return res.status(400).json({
                success: false,
                error: 'Product name and category are required'
            });
        }

        // Create mock analysis data for title generation
        const mockAnalysis = {
            category,
            features: features || [],
            sellingPoints: features || [],
            quality: { notes: 'Good quality product' }
        };

        // Generate titles with different tones and lengths
        const results = [];
        const tones = [tone, 'casual', 'trendy'];
        const lengths = ['short', 'medium', 'long'];

        for (const currentTone of tones) {
            for (const length of lengths) {
                try {
                    const contentData = await deepseekService.generateProductDescription(mockAnalysis, {
                        tone: currentTone,
                        length,
                        platform: 'general'
                    });

                    if (contentData.titles) {
                        results.push(...contentData.titles.map(title => ({
                            ...title,
                            tone: currentTone,
                            length
                        })));
                    }
                } catch (error) {
                    console.error(`Failed to generate ${currentTone} ${length} title:`, error);
                }
            }
        }

        // Remove duplicates and limit results
        const uniqueTitles = results
            .filter((title, index, self) => 
                index === self.findIndex(t => t.text.toLowerCase() === title.text.toLowerCase())
            )
            .slice(0, 12);

        res.json({
            success: true,
            data: {
                titles: uniqueTitles,
                count: uniqueTitles.length
            }
        });

    } catch (error) {
        next(error);
    }
});

// @desc    Generate keyword suggestions
// @route   POST /api/ai/generate-keywords
// @access  Protected  
router.post('/generate-keywords', protect, strictRateLimiter, async (req, res, next) => {
    try {
        const { category, productName, season, market = 'vietnam' } = req.body;

        if (!category) {
            return res.status(400).json({
                success: false,
                error: 'Category is required'
            });
        }

        // Get AI-generated keywords
        const aiKeywords = await deepseekService.generateTrendingKeywords(category, season);

        // Get n8n trending data
        const n8nData = await n8nService.fetchTrendingKeywords(category);

        // Get database trending keywords
        const dbKeywords = await Product.getTrendingKeywords(category, 20);

        // Combine all sources
        const combinedKeywords = {
            primary: [
                ...(aiKeywords.trending || []),
                ...dbKeywords.map(k => k.keyword)
            ].slice(0, 10),
            seasonal: aiKeywords.seasonal || [],
            local: aiKeywords.local || [],
            trending: [
                ...(n8nData.keywords || []),
                ...(aiKeywords.consumer_trends || [])
            ].slice(0, 15),
            seo: []
        };

        // Generate SEO keywords based on product name and category
        if (productName) {
            const seoKeywords = generateSEOKeywords(productName, category, combinedKeywords.primary);
            combinedKeywords.seo = seoKeywords;
        }

        res.json({
            success: true,
            data: {
                keywords: combinedKeywords,
                sources: {
                    ai: aiKeywords,
                    trending: n8nData.keywords,
                    database: dbKeywords.length
                }
            }
        });

    } catch (error) {
        next(error);
    }
});

// @desc    Analyze competitor products
// @route   POST /api/ai/analyze-competition
// @access  Protected
router.post('/analyze-competition', protect, strictRateLimiter, async (req, res, next) => {
    try {
        const { productName, category, keywords, platforms = ['shopee', 'lazada', 'tiki'] } = req.body;

        if (!productName || !category) {
            return res.status(400).json({
                success: false,
                error: 'Product name and category are required'
            });
        }

        // Trigger n8n competition analysis
        const competitionAnalysis = await n8nService.analyzeCompetition({
            name: productName,
            category: { primary: category },
            keywords: { primary: keywords || [] }
        });

        // Generate competitive insights with AI
        const competitiveInsights = await generateCompetitiveInsights(
            productName, 
            category, 
            competitionAnalysis.competitorData
        );

        res.json({
            success: true,
            data: {
                analysis: competitionAnalysis,
                insights: competitiveInsights,
                recommendations: generateCompetitiveRecommendations(competitionAnalysis.competitorData)
            }
        });

    } catch (error) {
        next(error);
    }
});

// @desc    Generate social media content
// @route   POST /api/ai/social-media-content
// @access  Protected
router.post('/social-media-content', protect, strictRateLimiter, async (req, res, next) => {
    try {
        const { productId, platforms = ['facebook', 'instagram', 'tiktok'] } = req.body;

        if (!productId) {
            return res.status(400).json({
                success: false,
                error: 'Product ID is required'
            });
        }

        const product = await Product.findOne({
            _id: productId,
            user: req.user._id
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        // Generate social media content via n8n
        const socialMediaContent = await n8nService.generateSocialMediaContent(product);

        res.json({
            success: true,
            data: {
                productId: product._id,
                content: socialMediaContent.generatedContent,
                contentId: socialMediaContent.contentId
            }
        });

    } catch (error) {
        next(error);
    }
});

// @desc    Get AI content suggestions
// @route   POST /api/ai/content-suggestions
// @access  Protected
router.post('/content-suggestions', protect, async (req, res, next) => {
    try {
        const { type, context, options = {} } = req.body;

        if (!type || !context) {
            return res.status(400).json({
                success: false,
                error: 'Type and context are required'
            });
        }

        let suggestions = [];

        switch (type) {
            case 'description_improvement':
                suggestions = await generateDescriptionImprovements(context, options);
                break;
            
            case 'title_alternatives':
                suggestions = await generateTitleAlternatives(context, options);
                break;
            
            case 'keyword_expansion':
                suggestions = await generateKeywordExpansions(context, options);
                break;
                
            case 'platform_optimization':
                suggestions = await generatePlatformOptimizations(context, options);
                break;
                
            default:
                return res.status(400).json({
                    success: false,
                    error: 'Invalid suggestion type'
                });
        }

        res.json({
            success: true,
            data: {
                type,
                suggestions,
                count: suggestions.length
            }
        });

    } catch (error) {
        next(error);
    }
});

// @desc    Batch process multiple products
// @route   POST /api/ai/batch-process
// @access  Protected
router.post('/batch-process', protect, strictRateLimiter, async (req, res, next) => {
    try {
        const { productIds, options = {} } = req.body;

        if (!Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Product IDs array is required'
            });
        }

        if (productIds.length > 10) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 10 products can be processed at once'
            });
        }

        const results = [];
        const errors = [];

        // Process each product
        for (const productId of productIds) {
            try {
                const product = await Product.findOne({
                    _id: productId,
                    user: req.user._id
                });

                if (!product) {
                    errors.push({ productId, error: 'Product not found' });
                    continue;
                }

                // Update status to processing
                await Product.findByIdAndUpdate(productId, {
                    $set: { status: 'processing', 'metadata.lastUpdated': new Date() }
                });

                // Trigger processing
                await n8nService.triggerProductProcessing(product);

                results.push({
                    productId,
                    status: 'processing',
                    message: 'Processing started'
                });

            } catch (error) {
                errors.push({ productId, error: error.message });
            }
        }

        res.json({
            success: true,
            data: {
                processed: results.length,
                errors: errors.length,
                results,
                errors
            }
        });

    } catch (error) {
        next(error);
    }
});

// Helper functions
function generateSEOKeywords(productName, category, primaryKeywords) {
    const seoKeywords = [];
    
    // Product name variations
    const nameWords = productName.toLowerCase().split(' ');
    seoKeywords.push(...nameWords.filter(word => word.length > 2));
    
    // Category combinations
    seoKeywords.push(`${category} ${productName.toLowerCase()}`);
    seoKeywords.push(`${productName.toLowerCase()} ${category}`);
    
    // Long-tail combinations
    primaryKeywords.slice(0, 5).forEach(keyword => {
        seoKeywords.push(`${keyword} ${productName.toLowerCase()}`);
        seoKeywords.push(`${productName.toLowerCase()} ${keyword}`);
    });

    // Vietnamese e-commerce specific
    seoKeywords.push(
        `mua ${productName.toLowerCase()}`,
        `${productName.toLowerCase()} giá rẻ`,
        `${productName.toLowerCase()} chất lượng`,
        `bán ${productName.toLowerCase()}`,
        `${productName.toLowerCase()} tphcm`,
        `${productName.toLowerCase()} hà nội`
    );

    return [...new Set(seoKeywords)].slice(0, 20);
}

async function generateCompetitiveInsights(productName, category, competitorData) {
    // This would typically use AI to analyze competitor data
    // For now, return mock insights based on competitor data structure
    return {
        marketPosition: 'competitive',
        pricingStrategy: 'value-based',
        differentiators: ['quality', 'pricing', 'customer service'],
        opportunities: ['social media marketing', 'seo optimization', 'product bundling'],
        threats: ['price competition', 'market saturation'],
        recommendations: [
            'Focus on unique selling propositions',
            'Improve product imagery and descriptions',
            'Consider competitive pricing strategies'
        ]
    };
}

function generateCompetitiveRecommendations(competitorData) {
    const recommendations = [];

    if (Array.isArray(competitorData) && competitorData.length > 0) {
        recommendations.push('Analyze competitor pricing strategies');
        recommendations.push('Study competitor product descriptions for inspiration');
        recommendations.push('Identify gaps in competitor offerings');
        recommendations.push('Monitor competitor keyword strategies');
    } else {
        recommendations.push('Limited competition detected - opportunity for market leadership');
        recommendations.push('Focus on establishing strong brand presence');
        recommendations.push('Invest in comprehensive keyword research');
    }

    return recommendations;
}

async function generateDescriptionImprovements(context, options) {
    // Mock implementation - in reality would use AI
    return [
        'Add more specific product specifications',
        'Include customer benefits and use cases',
        'Incorporate trending keywords naturally',
        'Improve readability with bullet points',
        'Add social proof elements'
    ];
}

async function generateTitleAlternatives(context, options) {
    // Mock implementation - in reality would use AI
    return [
        { text: 'Alternative title 1', tone: 'professional', length: 'medium' },
        { text: 'Alternative title 2', tone: 'casual', length: 'short' },
        { text: 'Alternative title 3', tone: 'trendy', length: 'long' }
    ];
}

async function generateKeywordExpansions(context, options) {
    // Mock implementation - in reality would use AI
    return [
        'Related keyword 1',
        'Related keyword 2',
        'Related keyword 3',
        'Long tail keyword phrase',
        'Seasonal keyword variant'
    ];
}

async function generatePlatformOptimizations(context, options) {
    // Mock implementation - in reality would use AI
    return [
        {
            platform: 'shopee',
            recommendations: ['Use trending hashtags', 'Optimize for mobile viewing']
        },
        {
            platform: 'lazada',
            recommendations: ['Include detailed specifications', 'Use professional imagery']
        },
        {
            platform: 'tiki',
            recommendations: ['Focus on quality messaging', 'Include certifications']
        }
    ];
}

module.exports = router;