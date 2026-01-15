"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'your-default-secret-key';
const verifyToken = (req, res, next) => {
    console.log(`[verifyToken] Headers:`, JSON.stringify(req.headers, null, 2));
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) {
        console.warn(`[verifyToken] No token found in Authorization header`);
        res.status(401).json({ message: "No token provided" });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = decoded; // attach user info to req
        next();
    }
    catch (error) {
        console.error("Error verifying token:", error.message);
        res.status(401).json({ message: "Invalid or expired token" });
    }
};
exports.verifyToken = verifyToken;
