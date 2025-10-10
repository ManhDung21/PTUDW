const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { protect } = require('../middleware/auth');
const { strictRateLimiter } = require('../middleware/rateLimiter');
const User = require('../models/User');

const router = express.Router();

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', strictRateLimiter, async (req, res, next) => {
    try {
        const { name, email, password, businessType } = req.body;

        // Check if user exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({
                success: false,
                error: 'Email already registered'
            });
        }

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            businessType: businessType || 'other'
        });

        // Generate token
        const token = user.getSignedJwtToken();

        // Update last login
        await user.updateLastLogin();

        res.status(201).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    businessType: user.businessType,
                    isEmailVerified: user.isEmailVerified
                },
                token
            },
            message: 'User registered successfully'
        });

    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                error: messages[0]
            });
        }
        next(error);
    }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', strictRateLimiter, async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validate email and password
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Please provide an email and password'
            });
        }

        // Check for user
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                error: 'Account has been deactivated'
            });
        }

        // Check if password matches
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Update last login
        await user.updateLastLogin();

        // Generate token
        const token = user.getSignedJwtToken();

        res.json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    businessType: user.businessType,
                    lastLogin: user.lastLogin,
                    isEmailVerified: user.isEmailVerified
                },
                token
            }
        });

    } catch (error) {
        next(error);
    }
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Protected
router.get('/me', protect, async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);

        res.json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    businessType: user.businessType,
                    profileImage: user.profileImage,
                    lastLogin: user.lastLogin,
                    isEmailVerified: user.isEmailVerified,
                    createdAt: user.createdAt
                }
            }
        });

    } catch (error) {
        next(error);
    }
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Protected
router.put('/profile', protect, async (req, res, next) => {
    try {
        const fieldsToUpdate = {
            name: req.body.name,
            businessType: req.body.businessType
        };

        // Remove undefined fields
        Object.keys(fieldsToUpdate).forEach(key => {
            if (fieldsToUpdate[key] === undefined) {
                delete fieldsToUpdate[key];
            }
        });

        const user = await User.findByIdAndUpdate(
            req.user._id,
            fieldsToUpdate,
            {
                new: true,
                runValidators: true
            }
        );

        res.json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    businessType: user.businessType,
                    profileImage: user.profileImage,
                    lastLogin: user.lastLogin,
                    isEmailVerified: user.isEmailVerified
                }
            }
        });

    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                error: messages[0]
            });
        }
        next(error);
    }
});

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Protected
router.put('/change-password', protect, strictRateLimiter, async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Please provide current and new passwords'
            });
        }

        // Get user with password
        const user = await User.findById(req.user._id).select('+password');

        // Check current password
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }

        // Validate new password
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'New password must be at least 6 characters'
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        next(error);
    }
});

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', strictRateLimiter, async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Please provide an email address'
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'No user found with that email'
            });
        }

        // Generate reset token
        const resetToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET + user.password, // Include password hash for security
            { expiresIn: '1h' }
        );

        // Save reset token to user
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 hour
        await user.save();

        // In production, send email with reset link
        // For development, return the token
        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;

        res.json({
            success: true,
            message: 'Password reset instructions sent to email',
            ...(process.env.NODE_ENV === 'development' && { 
                resetUrl, 
                resetToken 
            })
        });

    } catch (error) {
        next(error);
    }
});

// @desc    Reset password
// @route   POST /api/auth/reset-password/:resetToken
// @access  Public
router.post('/reset-password/:resetToken', strictRateLimiter, async (req, res, next) => {
    try {
        const { newPassword } = req.body;
        const { resetToken } = req.params;

        if (!newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Please provide a new password'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 6 characters'
            });
        }

        // Find user by reset token
        const user = await User.findOne({
            resetPasswordToken: resetToken,
            resetPasswordExpire: { $gt: Date.now() }
        }).select('+password');

        if (!user) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired reset token'
            });
        }

        // Verify token
        try {
            jwt.verify(resetToken, process.env.JWT_SECRET + user.password);
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: 'Invalid reset token'
            });
        }

        // Update password
        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        res.json({
            success: true,
            message: 'Password reset successful'
        });

    } catch (error) {
        next(error);
    }
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Protected
router.post('/logout', protect, (req, res) => {
    res.json({
        success: true,
        message: 'User logged out successfully'
    });
});

// @desc    Delete account
// @route   DELETE /api/auth/account
// @access  Protected
router.delete('/account', protect, strictRateLimiter, async (req, res, next) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({
                success: false,
                error: 'Please provide your password to confirm deletion'
            });
        }

        // Get user with password
        const user = await User.findById(req.user._id).select('+password');

        // Verify password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                error: 'Invalid password'
            });
        }

        // Delete user and associated data
        await User.findByIdAndDelete(req.user._id);
        
        // Note: In production, you might want to:
        // 1. Soft delete instead of hard delete
        // 2. Clean up associated products and images
        // 3. Send confirmation email

        res.json({
            success: true,
            message: 'Account deleted successfully'
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;