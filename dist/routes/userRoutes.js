"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userController_1 = require("../controllers/userController");
const verifyToken_1 = require("../middlewares/verifyToken");
const router = express_1.default.Router();
router.get("/me", verifyToken_1.verifyToken, userController_1.getProfile);
router.put("/update", verifyToken_1.verifyToken, userController_1.updateProfile);
router.delete("/delete", verifyToken_1.verifyToken, userController_1.deleteAccount);
exports.default = router;
