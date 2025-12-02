"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET;
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization; // lowercase 'authorization'
    const token = authHeader && authHeader.split(" ")[1]; // "Bearer <token>"
    if (!token) {
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
