const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ImageService {
    constructor() {
        this.uploadPath = process.env.UPLOAD_PATH || './uploads';
        this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10485760; // 10MB
        
        // Standard sizes for e-commerce platforms
        this.imageSizes = {
            thumbnail: { width: 150, height: 150 },
            small: { width: 300, height: 300 },
            medium: { width: 600, height: 600 },
            large: { width: 1200, height: 1200 },
            banner: { width: 1920, height: 1080 },
            square: { width: 800, height: 800 },
            // Platform specific sizes
            shopee: { width: 800, height: 800 },
            lazada: { width: 1000, height: 1000 },
            tiki: { width: 700, height: 700 }
        };
    }

    async processImage(inputBuffer, originalName, options = {}) {
        try {
            const {
                generateSizes = ['thumbnail', 'medium', 'large'],
                quality = 85,
                format = 'jpeg',
                optimize = true
            } = options;

            const fileId = uuidv4();
            const baseName = path.parse(originalName).name;
            const results = {
                original: null,
                processed: []
            };

            // Ensure upload directory exists
            await this.ensureDirectoryExists(this.uploadPath);

            // Get image metadata
            const metadata = await sharp(inputBuffer).metadata();
            console.log('Image metadata:', {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                size: inputBuffer.length
            });

            // Save original image (optimized)
            const originalPath = path.join(this.uploadPath, `${fileId}_original.${format}`);
            await sharp(inputBuffer)
                .jpeg({ quality, progressive: true })
                .toFile(originalPath);
            
            results.original = {
                path: originalPath,
                filename: `${fileId}_original.${format}`,
                width: metadata.width,
                height: metadata.height,
                size: inputBuffer.length
            };

            // Generate different sizes
            for (const sizeName of generateSizes) {
                if (this.imageSizes[sizeName]) {
                    const sizeConfig = this.imageSizes[sizeName];
                    const processedPath = path.join(this.uploadPath, `${fileId}_${sizeName}.${format}`);
                    
                    let processor = sharp(inputBuffer)
                        .resize(sizeConfig.width, sizeConfig.height, {
                            fit: 'cover',
                            position: 'center'
                        });

                    if (optimize) {
                        processor = processor.jpeg({ quality, progressive: true });
                    }

                    await processor.toFile(processedPath);
                    
                    results.processed.push({
                        path: processedPath,
                        filename: `${fileId}_${sizeName}.${format}`,
                        size: sizeName,
                        width: sizeConfig.width,
                        height: sizeConfig.height
                    });
                }
            }

            return results;

        } catch (error) {
            console.error('Image processing error:', error);
            throw new Error(`Failed to process image: ${error.message}`);
        }
    }

    async convertToBase64(filePath) {
        try {
            const imageBuffer = await fs.readFile(filePath);
            return imageBuffer.toString('base64');
        } catch (error) {
            console.error('Base64 conversion error:', error);
            throw new Error(`Failed to convert image to base64: ${error.message}`);
        }
    }

    async enhanceImage(inputBuffer, options = {}) {
        try {
            const {
                brightness = 1.0,
                contrast = 1.0,
                saturation = 1.0,
                sharpen = false,
                removeBackground = false
            } = options;

            let processor = sharp(inputBuffer);

            // Apply enhancements
            if (brightness !== 1.0 || contrast !== 1.0 || saturation !== 1.0) {
                processor = processor.modulate({
                    brightness: brightness,
                    saturation: saturation
                });
            }

            if (sharpen) {
                processor = processor.sharpen();
            }

            // Note: Background removal would require additional AI service
            // For now, we'll just return the enhanced image
            
            return await processor.jpeg({ quality: 90 }).toBuffer();

        } catch (error) {
            console.error('Image enhancement error:', error);
            throw new Error(`Failed to enhance image: ${error.message}`);
        }
    }

    async generatePlatformImages(originalPath, platforms = ['shopee', 'lazada', 'tiki']) {
        try {
            const results = [];
            const originalBuffer = await fs.readFile(originalPath);
            const fileId = uuidv4();

            for (const platform of platforms) {
                if (this.imageSizes[platform]) {
                    const sizeConfig = this.imageSizes[platform];
                    const platformPath = path.join(this.uploadPath, `${fileId}_${platform}.jpeg`);
                    
                    await sharp(originalBuffer)
                        .resize(sizeConfig.width, sizeConfig.height, {
                            fit: 'cover',
                            position: 'center'
                        })
                        .jpeg({ quality: 85, progressive: true })
                        .toFile(platformPath);
                    
                    results.push({
                        platform,
                        path: platformPath,
                        filename: `${fileId}_${platform}.jpeg`,
                        width: sizeConfig.width,
                        height: sizeConfig.height
                    });
                }
            }

            return results;

        } catch (error) {
            console.error('Platform image generation error:', error);
            throw new Error(`Failed to generate platform images: ${error.message}`);
        }
    }

    async analyzeImageQuality(imagePath) {
        try {
            const metadata = await sharp(imagePath).metadata();
            const stats = await sharp(imagePath).stats();
            
            // Calculate quality metrics
            const qualityScore = this.calculateQualityScore(metadata, stats);
            const visualAppeal = this.calculateVisualAppeal(stats);
            
            return {
                resolution: {
                    width: metadata.width,
                    height: metadata.height,
                    megapixels: (metadata.width * metadata.height) / 1000000
                },
                quality: {
                    score: qualityScore,
                    visualAppeal: visualAppeal,
                    sharpness: this.assessSharpness(stats),
                    brightness: this.assessBrightness(stats),
                    contrast: this.assessContrast(stats)
                },
                technical: {
                    format: metadata.format,
                    colorSpace: metadata.space,
                    hasAlpha: metadata.hasAlpha,
                    channels: metadata.channels
                },
                recommendations: this.generateImageRecommendations(metadata, stats, qualityScore)
            };

        } catch (error) {
            console.error('Image quality analysis error:', error);
            throw new Error(`Failed to analyze image quality: ${error.message}`);
        }
    }

    calculateQualityScore(metadata, stats) {
        let score = 5; // Base score

        // Resolution scoring
        const megapixels = (metadata.width * metadata.height) / 1000000;
        if (megapixels >= 2) score += 2;
        else if (megapixels >= 1) score += 1;

        // Aspect ratio scoring (prefer square or standard ratios)
        const aspectRatio = metadata.width / metadata.height;
        if (Math.abs(aspectRatio - 1) < 0.1) score += 1; // Square
        else if (aspectRatio >= 0.75 && aspectRatio <= 1.33) score += 0.5; // Standard ratios

        // Channel scoring (color images preferred)
        if (metadata.channels >= 3) score += 1;

        return Math.min(10, Math.max(0, score));
    }

    calculateVisualAppeal(stats) {
        // Based on statistical analysis of image channels
        let appeal = 5;

        // Brightness (avoid too dark or too bright)
        const avgBrightness = stats.channels.reduce((sum, ch) => sum + ch.mean, 0) / stats.channels.length;
        if (avgBrightness >= 80 && avgBrightness <= 180) appeal += 2;
        else if (avgBrightness >= 60 && avgBrightness <= 200) appeal += 1;

        // Contrast (higher standard deviation indicates better contrast)
        const avgStdDev = stats.channels.reduce((sum, ch) => sum + ch.stdev, 0) / stats.channels.length;
        if (avgStdDev >= 40) appeal += 2;
        else if (avgStdDev >= 25) appeal += 1;

        return Math.min(10, Math.max(0, appeal));
    }

    assessSharpness(stats) {
        const avgStdDev = stats.channels.reduce((sum, ch) => sum + ch.stdev, 0) / stats.channels.length;
        if (avgStdDev >= 50) return 'excellent';
        if (avgStdDev >= 35) return 'good';
        if (avgStdDev >= 20) return 'fair';
        return 'poor';
    }

    assessBrightness(stats) {
        const avgBrightness = stats.channels.reduce((sum, ch) => sum + ch.mean, 0) / stats.channels.length;
        if (avgBrightness >= 200) return 'too_bright';
        if (avgBrightness >= 150) return 'bright';
        if (avgBrightness >= 80) return 'optimal';
        if (avgBrightness >= 40) return 'dark';
        return 'too_dark';
    }

    assessContrast(stats) {
        const avgStdDev = stats.channels.reduce((sum, ch) => sum + ch.stdev, 0) / stats.channels.length;
        if (avgStdDev >= 60) return 'high';
        if (avgStdDev >= 40) return 'good';
        if (avgStdDev >= 25) return 'fair';
        return 'low';
    }

    generateImageRecommendations(metadata, stats, qualityScore) {
        const recommendations = [];

        if (qualityScore < 6) {
            recommendations.push('Consider using a higher resolution image for better quality');
        }

        const megapixels = (metadata.width * metadata.height) / 1000000;
        if (megapixels < 1) {
            recommendations.push('Image resolution is too low for e-commerce use');
        }

        const avgBrightness = stats.channels.reduce((sum, ch) => sum + ch.mean, 0) / stats.channels.length;
        if (avgBrightness < 60) {
            recommendations.push('Image appears too dark, consider brightening');
        } else if (avgBrightness > 200) {
            recommendations.push('Image appears too bright, consider darkening');
        }

        const avgStdDev = stats.channels.reduce((sum, ch) => sum + ch.stdev, 0) / stats.channels.length;
        if (avgStdDev < 25) {
            recommendations.push('Image lacks contrast, consider enhancing');
        }

        const aspectRatio = metadata.width / metadata.height;
        if (Math.abs(aspectRatio - 1) > 0.5) {
            recommendations.push('Consider cropping to a more square aspect ratio for better platform compatibility');
        }

        if (recommendations.length === 0) {
            recommendations.push('Image quality is good for e-commerce use');
        }

        return recommendations;
    }

    async ensureDirectoryExists(dirPath) {
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }

    async deleteImage(imagePath) {
        try {
            await fs.unlink(imagePath);
            return true;
        } catch (error) {
            console.error('Failed to delete image:', error);
            return false;
        }
    }

    async cleanup(olderThanDays = 7) {
        try {
            const files = await fs.readdir(this.uploadPath);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

            let deletedCount = 0;
            for (const file of files) {
                const filePath = path.join(this.uploadPath, file);
                const stats = await fs.stat(filePath);
                
                if (stats.mtime < cutoffDate) {
                    await this.deleteImage(filePath);
                    deletedCount++;
                }
            }

            console.log(`Cleaned up ${deletedCount} old images`);
            return { deletedCount };

        } catch (error) {
            console.error('Image cleanup error:', error);
            throw new Error(`Failed to cleanup images: ${error.message}`);
        }
    }
}

module.exports = new ImageService();