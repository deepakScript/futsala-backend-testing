"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAsRead = exports.getAllNotifications = void 0;
const prismaClient_1 = __importDefault(require("../config/prismaClient"));
/**
 * Get all notifications for user
 * @route GET /
 */
const getAllNotifications = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }
        const notifications = await prismaClient_1.default.notification.findMany({
            where: { userId },
            orderBy: {
                createdAt: 'desc'
            }
        });
        // Count unread notifications
        const unreadCount = notifications.filter(n => !n.isRead).length;
        return res.status(200).json({
            success: true,
            count: notifications.length,
            unreadCount: unreadCount,
            data: notifications
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getAllNotifications = getAllNotifications;
/**
 * Mark a notification as read
 * @route PUT /read/:id
 */
const markAsRead = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { id } = req.params;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }
        // Check if notification exists and belongs to user
        const notification = await prismaClient_1.default.notification.findUnique({
            where: { id }
        });
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }
        if (notification.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'You can only update your own notifications'
            });
        }
        // Update notification to mark as read
        const updatedNotification = await prismaClient_1.default.notification.update({
            where: { id },
            data: {
                isRead: true
            }
        });
        return res.status(200).json({
            success: true,
            message: 'Notification marked as read',
            data: updatedNotification
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to update notification',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.markAsRead = markAsRead;
