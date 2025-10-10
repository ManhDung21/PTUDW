const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a product name'],
        trim: true,
        maxlength: [200, 'Product name cannot exceed 200 characters']
    },
    originalImage: {
        type: String,
        required: [true, 'Please add an image'],
    },
    processedImages: [{
        type: String,
        size: String,
        width: Number,
        height: Number
    }],
    category: {
        primary: {
            type: String,
            required: [true, 'Please select a primary category'],
            enum: [
                'fruits', 'vegetables', 'grains', 'herbs', 'spices',
                'dairy', 'meat', 'seafood', 'beverages', 'processed_foods',
                'organic', 'imported', 'local_specialties'
            ]
        },
        secondary: {
            type: String,
            default: null
        },
        tags: [String]
    },
    description: {
        generated: {
            type: String,
            required: true
        },
        edited: {
            type: String,
            default: null
        },
        final: {
            type: String,
            required: true
        }
    },
    titles: [{
        text: String,
        tone: {
            type: String,
            enum: ['professional', 'casual', 'trendy', 'premium'],
            default: 'professional'
        },
        length: {
            type: String,
            enum: ['short', 'medium', 'long'],
            default: 'medium'
        }
    }],
    keywords: {
        primary: [String],
        trending: [String],
        seasonal: [String],
        seo: [String]
    },
    pricing: {
        suggestedRange: {
            min: Number,
            max: Number,
            currency: {
                type: String,
                default: 'VND'
            }
        },
        marketComparison: [{
            platform: String,
            averagePrice: Number,
            url: String
        }]
    },
    specifications: {
        weight: String,
        dimensions: String,
        origin: String,
        season: String,
        shelfLife: String,
        nutritionalHighlights: [String],
        certifications: [String]
    },
    aiAnalysis: {
        confidence: {
            type: Number,
            min: 0,
            max: 1
        },
        detectedFeatures: [String],
        qualityScore: {
            type: Number,
            min: 0,
            max: 10
        },
        freshness: {
            type: String,
            enum: ['excellent', 'good', 'fair', 'poor'],
            default: 'good'
        },
        visualAppeal: {
            type: Number,
            min: 0,
            max: 10
        }
    },
    marketingInsights: {
        targetAudience: [String],
        sellingPoints: [String],
        competitiveAdvantages: [String],
        suggestedPlatforms: [String]
    },
    status: {
        type: String,
        enum: ['draft', 'processing', 'completed', 'published', 'archived'],
        default: 'draft'
    },
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    processingTime: {
        type: Number, // in milliseconds
        default: 0
    },
    metadata: {
        imageAnalysisVersion: String,
        textGenerationModel: String,
        processingDate: Date,
        lastUpdated: Date
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Create indexes for better query performance
ProductSchema.index({ user: 1, createdAt: -1 });
ProductSchema.index({ 'category.primary': 1, status: 1 });
ProductSchema.index({ 'keywords.primary': 1 });
ProductSchema.index({ status: 1, createdAt: -1 });

// Virtual for final title
ProductSchema.virtual('finalTitle').get(function() {
    if (this.titles && this.titles.length > 0) {
        return this.titles.find(t => t.tone === 'professional') || this.titles[0];
    }
    return { text: this.name };
});

// Method to get the most appropriate description
ProductSchema.methods.getFinalDescription = function() {
    return this.description.edited || this.description.final || this.description.generated;
};

// Method to generate SEO-friendly slug
ProductSchema.methods.generateSlug = function() {
    return this.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 100);
};

// Static method to get trending keywords
ProductSchema.statics.getTrendingKeywords = async function(category, limit = 10) {
    const pipeline = [
        { $match: { 'category.primary': category, status: 'completed' } },
        { $unwind: '$keywords.trending' },
        { $group: { _id: '$keywords.trending', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
        { $project: { keyword: '$_id', count: 1, _id: 0 } }
    ];
    
    return this.aggregate(pipeline);
};

module.exports = mongoose.model('Product', ProductSchema);