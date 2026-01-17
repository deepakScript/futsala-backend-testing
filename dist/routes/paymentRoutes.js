"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const paymentController_1 = require("../controllers/paymentController");
const verifyToken_1 = require("../middlewares/verifyToken");
const router = express_1.default.Router();
router.post("/initiate", verifyToken_1.verifyToken, paymentController_1.initiatePayment);
router.post("/verify", verifyToken_1.verifyToken, paymentController_1.verifyPayment);
router.get("/history", verifyToken_1.verifyToken, paymentController_1.getPaymentHistory);
exports.default = router;
