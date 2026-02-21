"use strict";

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendSuccess, sendError, CODES } = require("../lib/errorResponse");
const { logActivity } = require("../lib/activityLogger");

const router = express.Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "your-secret-key";
const JWT_EXPIRES_IN = "24h";

/**
 * POST /api/v1/auth/register
 * Register a new user
 */
router.post("/auth/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validation
        if (!username || username.length < 3) {
            return sendError(res, 400, "Username must be at least 3 characters", {
                code: CODES.VALIDATION_ERROR,
            });
        }

        if (!email || !email.includes("@")) {
            return sendError(res, 400, "Invalid email address", {
                code: CODES.VALIDATION_ERROR,
            });
        }

        if (!password || password.length < 6) {
            return sendError(res, 400, "Password must be at least 6 characters", {
                code: CODES.VALIDATION_ERROR,
            });
        }

        // Check if user exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email }, { username }],
            },
        });

        if (existingUser) {
            return sendError(res, 409, "User with this email or username already exists", {
                code: CODES.CONFLICT,
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const user = await prisma.user.create({
            data: {
                username,
                email,
                passwordHash,
                role: "developer", // Default role
                isActive: true,
            },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
            },
        });

        console.log(`✅ New user registered: ${username}`);

        await logActivity({
            actionType: "user_registered",
            actionCategory: "auth",
            entityType: "user",
            entityId: user.id,
            performedById: user.id,
            actionSummary: `User ${username} (${email}) registered`,
        }, req);

        sendSuccess(res, {
            message: "User registered successfully",
            user,
        });
    } catch (error) {
        console.error("Registration error:", error);
        sendError(res, 500, "Failed to register user", {
            code: CODES.INTERNAL_ERROR,
        });
    }
});

/**
 * POST /api/v1/auth/login
 * Authenticate user and return JWT token
 */
router.post("/auth/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return sendError(res, 400, "Username and password are required", {
                code: CODES.VALIDATION_ERROR,
            });
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { username },
            select: {
                id: true,
                username: true,
                email: true,
                passwordHash: true,
                role: true,
                isActive: true,
            },
        });

        if (!user) {
            console.log(`Login 401: user not found (username: ${username})`);
            return sendError(res, 401, "Invalid credentials", {
                code: CODES.UNAUTHORIZED,
            });
        }

        if (!user.isActive) {
            return sendError(res, 403, "Account is inactive", {
                code: CODES.FORBIDDEN,
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.passwordHash);

        if (!isValidPassword) {
            console.log(`Login 401: invalid password for user (username: ${username})`);
            return sendError(res, 401, "Invalid credentials", {
                code: CODES.UNAUTHORIZED,
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        console.log(`✅ User logged in: ${username}`);

        await logActivity({
            actionType: "user_login",
            actionCategory: "auth",
            entityType: "user",
            entityId: user.id,
            performedById: user.id,
            actionSummary: `User ${username} logged in`,
        }, req);

        sendSuccess(res, {
            message: "Login successful",
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error("Login error:", error);
        sendError(res, 500, "Failed to login", {
            code: CODES.INTERNAL_ERROR,
        });
    }
});

/**
 * GET /api/v1/auth/me
 * Get current authenticated user
 */
router.get("/auth/me", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return sendError(res, 401, "No token provided", {
                code: CODES.UNAUTHORIZED,
            });
        }

        const token = authHeader.substring(7);

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Get user
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
            },
        });

        if (!user) {
            return sendError(res, 404, "User not found", {
                code: CODES.NOT_FOUND,
            });
        }

        if (!user.isActive) {
            return sendError(res, 403, "Account is inactive", {
                code: CODES.FORBIDDEN,
            });
        }

        sendSuccess(res, { user });
    } catch (error) {
        if (error.name === "JsonWebTokenError") {
            return sendError(res, 401, "Invalid token", {
                code: CODES.UNAUTHORIZED,
            });
        }
        if (error.name === "TokenExpiredError") {
            return sendError(res, 401, "Token expired", {
                code: CODES.UNAUTHORIZED,
            });
        }

        console.error("Auth me error:", error);
        sendError(res, 500, "Failed to get user", {
            code: CODES.INTERNAL_ERROR,
        });
    }
});

module.exports = router;
