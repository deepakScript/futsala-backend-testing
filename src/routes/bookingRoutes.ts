import express from "express";
import {checkAvailability, createBooking, getMyBookings, getBookingById, cancelBooking, rescheduleBooking} from "../controllers/bookingController";
import { verifyToken } from "../middlewares/verifyToken";

const router = express.Router();

router.get("/availability",checkAvailability);  //done
router.post("/create",createBooking);   //done
router.get("/my-bookings",getMyBookings);   //
router.get("/booking/:id",getBookingById);
router.delete("/cancel/:id",cancelBooking);
router.put("/reschedule/:id",rescheduleBooking);

export default router;
