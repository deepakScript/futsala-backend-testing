"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const reviewController_1 = require("../controllers/reviewController");
const verifyToken_1 = require("../middlewares/verifyToken");
const router = express_1.default.Router();
router.post("/create/:futsalId", verifyToken_1.verifyToken, reviewController_1.createReview);
router.get("/futsal/:futsalId", reviewController_1.getVenueReviews);
router.delete("/delete/:reviewId", verifyToken_1.verifyToken, reviewController_1.deleteReview);
exports.default = router;
