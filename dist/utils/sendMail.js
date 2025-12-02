"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nodemailer_1 = __importDefault(require("nodemailer"));
const sendMail = async ({ to, subject, html }) => {
    const transporter = nodemailer_1.default.createTransport({
        host: process.env.MAIL_HOST,
        port: parseInt(process.env.MAIL_PORT || "587", 10),
        secure: false, // Use true for port 465, false for others (e.g., 587)
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASSWORD,
        },
        tls: {
            rejectUnauthorized: false, // only for development / Mailtrap
        },
    });
    const mailOptions = {
        from: `Support <${process.env.MAIL_USER}>`,
        to,
        subject,
        html,
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to ${to}`);
    }
    catch (error) {
        console.error("❌ Failed to send email:", error);
        throw error;
    }
};
exports.default = sendMail;
