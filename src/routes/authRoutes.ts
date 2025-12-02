import express from "express";
import { registerUser, loginUser, forgotPassword, otpVerification, savePassword } from "../controllers/authController";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/otp-verification",otpVerification)
router.post("/save-password",savePassword );

export default router;
