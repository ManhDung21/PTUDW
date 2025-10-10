const express = require('express');
const multer = require('multer');
const path = require('path');
const { protect, optional } = require('../middleware/auth');
const { strictRateLimiter } = require('../middleware/rateLimiter');
const Product = require('../models/Product');
const imageService = require('../services/imageService');
const deepseekService = require('../services/deepseekService');
const n8nService = require('../services/n8nService');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB
    },
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files (JPEG, JPG, PNG, WebP) are allowed'));
        }
    }
});

// @desc    Upload and analyze product image
// @route   POST /api/products/upload
// @access  Protected
router.post('/upload', protect, strictRateLimiter, upload.single('image'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Please upload an image file'
            });
        }

        const { name, category, description } = req.body;

        // Process the uploaded image
        const processedImages = await imageService.processImage(
            req.file.buffer, 
            req.file.originalname,
            {
                generateSizes: ['thumbnail', 'medium', 'large', 'shopee', 'lazada', 'tiki'],
                quality: 85,
                optimize: true
            }
        );

        // Analyze image quality
        const qualityAnalysis = await imageService.analyzeImageQuality(processedImages.original.path);

        // Convert to base64 for AI analysis
        const imageBase64 = await imageService.convertToBase64(processedImages.original.path);

        // Create initial product record
        const product = await Product.create({
            name: name || `Product ${Date.now()}`,
            originalImage: `/uploads/${processedImages.original.filename}`,
            processedImages: processedImages.processed.map(img => ({
                type: String,
                size: img.size,
                width: img.width,
                height: img.height
            })),
            category: {
                primary: category || 'other'
            },
            description: {
                generated: description || 'Processing...',
                final: description || 'Processing...'
            },
            aiAnalysis: {
                confidence: 0,
                qualityScore: qualityAnalysis.quality.score,
                visualAppeal: qualityAnalysis.quality.visualAppeal
            },
            status: 'processing',
            user: req.user._id,
            metadata: {
                processingDate: new Date(),
                imageAnalysisVersion: '1.0'
            }
        });

        // Trigger n8n workflow
        await n8nService.triggerProductProcessing(product);

        // Start AI processing in background
        processProductWithAI(product._id, imageBase64, {
            category: category,
            userDescription: description
        });

        res.status(201).json({
            success: true,
            data: {
                productId: product._id,
                status: 'processing',
                imageUrl: product.originalImage,
                qualityAnalysis: qualityAnalysis
            },
            message: 'Image uploaded successfully. AI analysis is in progress.'
        });

    } catch (error) {
        next(error);
    }
});

// @desc    Get all products for user
// @route   GET /api/products
// @access  Protected
router.get('/', protect, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const filter = { user: req.user._id };
        
        // Add status filter if provided
        if (req.query.status) {
            filter.status = req.query.status;
        }

        // Add category filter if provided
        if (req.query.category) {
            filter['category.primary'] = req.query.category;
        }

        // Search in name and description
        if (req.query.search) {
            filter.$or = [
                { name: { $regex: req.query.search, $options: 'i' } },
                { 'description.final': { $regex: req.query.search, $options: 'i' } }
            ];
        }

        const products = await Product.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip(skip)
            .select('-__v');

        const total = await Product.countDocuments(filter);

        res.json({
            success: true,
            count: products.length,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            data: products
        });

    } catch (error) {
        next(error);
    }
});

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Protected
router.get('/:id', protect, async (req, res, next) => {
    try {
        const product = await Product.findOne({
            _id: req.params.id,
            user: req.user._id
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        res.json({
            success: true,
            data: product
        });

    } catch (error) {
        next(error);
    }
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Protected
router.put('/:id', protect, async (req, res, next) => {
    try {
        let product = await Product.findOne({
            _id: req.params.id,
            user: req.user._id
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        // Update allowed fields
        const allowedUpdates = [
            'name', 'description.edited', 'category', 'specifications',
            'keywords', 'pricing'
        ];

        const updates = {};
        Object.keys(req.body).forEach(key => {
            if (allowedUpdates.includes(key)) {
                if (key === 'description.edited') {
                    updates['description.edited'] = req.body[key];
                    updates['description.final'] = req.body[key]; // Update final description too
                } else {
                    updates[key] = req.body[key];
                }
            }
        });

        updates['metadata.lastUpdated'] = new Date();

        product = await Product.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        res.json({
            success: true,
            data: product
        });

    } catch (error) {
        next(error);
    }
});

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Protected
router.delete('/:id', protect, async (req, res, next) => {
    try {
        const product = await Product.findOne({
            _id: req.params.id,
            user: req.user._id
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        // Delete associated image files
        if (product.originalImage) {
            const imagePath = path.join(process.cwd(), 'uploads', path.basename(product.originalImage));
            await imageService.deleteImage(imagePath);
        }

        // Delete processed images
        for (const processedImage of product.processedImages) {
            if (processedImage.path) {
                await imageService.deleteImage(processedImage.path);
            }
        }

        await Product.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Product deleted successfully'
        });

    } catch (error) {
        next(error);
    }
});

// @desc    Get trending keywords for category
// @route   GET /api/products/trending/:category
// @access  Public
router.get('/trending/:category', optional, async (req, res, next) => {
    try {
        const { category } = req.params;
        const limit = parseInt(req.query.limit) || 10;

        // Get trending keywords from database
        const dbKeywords = await Product.getTrendingKeywords(category, limit);

        // Get trending keywords from n8n
        const n8nResult = await n8nService.fetchTrendingKeywords(category);

        // Get trending keywords from AI
        const aiKeywords = await deepseekService.generateTrendingKeywords(category);

        // Combine and deduplicate
        const allKeywords = [
            ...dbKeywords.map(k => ({ keyword: k.keyword, source: 'database', count: k.count })),
            ...n8nResult.keywords.map(k => ({ keyword: k, source: 'n8n', count: 0 })),
            ...(aiKeywords.trending || []).map(k => ({ keyword: k, source: 'ai', count: 0 }))
        ];

        // Remove duplicates and sort by relevance
        const uniqueKeywords = Array.from(
            new Map(allKeywords.map(item => [item.keyword.toLowerCase(), item])).values()
        ).slice(0, limit);

        res.json({
            success: true,
            data: {
                category,
                keywords: uniqueKeywords,
                seasonal: aiKeywords.seasonal || [],
                local: aiKeywords.local || [],
                trends: n8nResult.trends || []
            }
        });

    } catch (error) {
        next(error);
    }
});

// @desc    Regenerate product content with AI
// @route   POST /api/products/:id/regenerate
// @access  Protected
router.post('/:id/regenerate', protect, strictRateLimiter, async (req, res, next) => {
    try {
        const product = await Product.findOne({
            _id: req.params.id,
            user: req.user._id
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        const { tone, length, platform, includeSpecs } = req.body;

        // Convert image to base64 for AI analysis
        const imagePath = path.join(process.cwd(), 'uploads', path.basename(product.originalImage));
        const imageBase64 = await imageService.convertToBase64(imagePath);

        // Re-analyze with AI
        const analysisData = await deepseekService.analyzeImage(imageBase64, product.category.primary);

        // Generate new content
        const contentData = await deepseekService.generateProductDescription(analysisData, {
            tone,
            length,
            platform,
            includeSpecs
        });

        // Update product
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    'description.generated': contentData.description,
                    'description.final': contentData.description,
                    titles: contentData.titles || [],
                    keywords: {
                        ...product.keywords,
                        ...contentData.keywords
                    },
                    'metadata.lastUpdated': new Date(),
                    'metadata.textGenerationModel': 'deepseek-v2'
                }
            },
            { new: true, runValidators: true }
        );

        res.json({
            success: true,
            data: updatedProduct,
            message: 'Product content regenerated successfully'
        });

    } catch (error) {
        next(error);
    }
});

// Background AI processing function
async function processProductWithAI(productId, imageBase64, options) {
    try {
        const startTime = Date.now();

        // Analyze image with AI
        const analysisData = await deepseekService.analyzeImage(imageBase64, options.category);

        // Generate product description
        const contentData = await deepseekService.generateProductDescription(analysisData);

        // Get pricing suggestions
        const pricingData = await deepseekService.suggestPricing(analysisData);

        const processingTime = Date.now() - startTime;

        // Update product with AI results
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            {
                $set: {
                    'category.primary': analysisData.category || options.category,
                    'category.secondary': analysisData.subcategory,
                    'description.generated': contentData.description,
                    'description.final': contentData.description,
                    titles: contentData.titles || [],
                    keywords: contentData.keywords || {},
                    'pricing.suggestedRange': pricingData.suggestedRange,
                    'aiAnalysis.confidence': analysisData.confidence,
                    'aiAnalysis.detectedFeatures': analysisData.features || [],
                    'aiAnalysis.freshness': analysisData.quality?.freshness || 'good',
                    'marketingInsights.targetAudience': analysisData.targetAudience || [],
                    'marketingInsights.sellingPoints': analysisData.sellingPoints || [],
                    status: 'completed',
                    processingTime: processingTime,
                    'metadata.textGenerationModel': 'deepseek-chat',
                    'metadata.lastUpdated': new Date()
                }
            },
            { new: true }
        );

        // Notify n8n of completion
        await n8nService.notifyProductCompleted(updatedProduct, {
            description: contentData.description,
            keywords: contentData.keywords,
            processingTime,
            aiAnalysis: analysisData
        });

        console.log(`Product ${productId} processed successfully in ${processingTime}ms`);

    } catch (error) {
        console.error(`Failed to process product ${productId}:`, error);
        
        // Update product status to error
        await Product.findByIdAndUpdate(
            productId,
            {
                $set: {
                    status: 'error',
                    'metadata.lastUpdated': new Date(),
                    'metadata.errorMessage': error.message
                }
            }
        );
    }
}

module.exports = router;