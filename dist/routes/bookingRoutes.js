"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bookingController_1 = require("../controllers/bookingController");
const verifyToken_1 = require("../middlewares/verifyToken");
const router = express_1.default.Router();
router.get("/availability", bookingController_1.checkAvailability);
router.post("/create", verifyToken_1.verifyToken, bookingController_1.createBooking);
router.get("/my-bookings", verifyToken_1.verifyToken, bookingController_1.getMyBookings);
router.get("/booking/:id", verifyToken_1.verifyToken, bookingController_1.getBookingById);
router.put("/cancel/:id", verifyToken_1.verifyToken, bookingController_1.cancelBooking);
router.put("/reschedule/:id", verifyToken_1.verifyToken, bookingController_1.rescheduleBooking);
exports.default = router;
