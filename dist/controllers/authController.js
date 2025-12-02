"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllUsers = exports.refreshAccessToken = exports.forgotPassword = exports.loginUser = exports.registerUser = void 0;
const prismaClient_1 = __importDefault(require("../config/prismaClient"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const sendMail_1 = __importDefault(require("../utils/sendMail"));
const registerUser = async (req, res) => {
    const { fullName, email, password, phoneNumber } = req.body;
    try {
        // Check if email already exists
        const existingUserByEmail = await prismaClient_1.default.user.findUnique({
            where: { email }
        });
        if (existingUserByEmail) {
            console.log("exist email");
            return res.status(400).json({ error: "Email is already registered" });
        }
        // Check if phone number already exists
        const existingUserByPhone = await prismaClient_1.default.user.findFirst({
            where: { phoneNumber }
        });
        if (existingUserByPhone) {
            console.log("exist phone");
            return res.status(400).json({ error: "Phone number is already registered" });
        }
        const hashed = await bcryptjs_1.default.hash(password, 10);
        const user = await prismaClient_1.default.user.create({
            data: {
                fullName,
                email,
                password: hashed,
                phoneNumber,
                isVerified: false,
            },
        });
        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;
        res.status(201).json({
            message: "success",
            user: userWithoutPassword
        });
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2002') {
                return res.status(400).json({ error: "Email already exists" });
            }
        }
        res.status(500).json({ error: "Registration feeled" });
        console.log(error);
    }
};
exports.registerUser = registerUser;
const loginUser = async (req, res) => {
    const { email, password } = req.body;
    //my change in the login  section 
    try {
        // Check if user exists with the provided email
        const user = await prismaClient_1.default.user.findUnique({
            where: { email }
        });
        if (!user) {
            return res.status(401).json({ error: "Invalid email or password" });
        }
        // Verify password
        const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: "Invalid email or password" });
        }
        // Generate access token (short-lived)
        const accessToken = jsonwebtoken_1.default.sign({
            userId: user.id,
            email: user.email,
            role: user.role,
            type: 'access'
        }, process.env.JWT_SECRET || 'your-default-secret-key', { expiresIn: '15m' } // 15 minutes
        );
        // Generate refresh token (long-lived)
        const refreshToken = jsonwebtoken_1.default.sign({
            userId: user.id,
            email: user.email,
            role: user.role,
            type: 'refresh'
        }, process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key', { expiresIn: '7d' } // 7 days
        );
        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;
        // Set refresh token in HTTP-only cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'development',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
        });
        res.status(200).json({
            message: "Login successful",
            user: userWithoutPassword,
            auth: {
                accessToken,
                expiresIn: 900 // 15 minutes in seconds
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: "Login failed" });
    }
};
exports.loginUser = loginUser;
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await prismaClient_1.default.user.findUnique({ where: { email } });
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const resetToken = crypto_1.default.randomBytes(32).toString("hex");
        const hashedToken = crypto_1.default.createHash("sha256").update(resetToken).digest("hex");
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour expiry
        // Store hashed token in DB
        await prismaClient_1.default.passwordResetToken.create({
            data: {
                token: hashedToken,
                userId: user.id,
                expiresAt,
            },
        });
        const html = `<p>Your password reset token is:</p><b>${resetToken}</b>`;
        await (0, sendMail_1.default)({ to: user.email, subject: "Password Reset Token", html });
        res.status(200).json({
            message: "Reset token sent to email",
            // Don't send the token in the response for security
        });
    }
    catch (error) {
        console.error("Forgot Password Error:", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.forgotPassword = forgotPassword;
const refreshAccessToken = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ error: "Refresh token not found" });
        }
        try {
            // Verify refresh token
            const payload = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key');
            // Check if it's actually a refresh token
            if (payload.type !== 'refresh') {
                return res.status(401).json({ error: "Invalid token type" });
            }
            // Verify user still exists
            const user = await prismaClient_1.default.user.findUnique({
                where: { id: payload.userId }
            });
            if (!user) {
                return res.status(401).json({ error: "User no longer exists" });
            }
            // Generate new access token
            const accessToken = jsonwebtoken_1.default.sign({
                userId: user.id,
                email: user.email,
                role: user.role,
                type: 'access'
            }, process.env.JWT_SECRET || 'your-default-secret-key', { expiresIn: '15m' });
            res.json({
                accessToken,
                expiresIn: 900 // 15 minutes in seconds
            });
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                return res.status(401).json({ error: "Invalid refresh token" });
            }
            throw error;
        }
    }
    catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ error: "Failed to refresh token" });
    }
};
exports.refreshAccessToken = refreshAccessToken;
const getAllUsers = async (_, res) => {
    try {
        const users = await prismaClient_1.default.user.findMany({
            select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
                role: true,
                isVerified: true,
                createdAt: true,
                updatedAt: true
            },
        });
        res.json(users);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
};
exports.getAllUsers = getAllUsers;
