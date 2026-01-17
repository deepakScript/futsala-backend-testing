"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const notificationController_1 = require("../controllers/notificationController");
const verifyToken_1 = require("../middlewares/verifyToken");
const router = express_1.default.Router();
router.get("/", verifyToken_1.verifyToken, notificationController_1.getAllNotifications);
router.put("/read/:id", verifyToken_1.verifyToken, notificationController_1.markAsRead);
exports.default = router;
