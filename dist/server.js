"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const db_1 = __importDefault(require("./config/db"));
const morgan_1 = __importDefault(require("morgan"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const futsalRoutes_1 = __importDefault(require("./routes/futsalRoutes"));
const bookingRoutes_1 = __importDefault(require("./routes/bookingRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const paymentRoutes_1 = __importDefault(require("./routes/paymentRoutes"));
const reviewRoutes_1 = __importDefault(require("./routes/reviewRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
// middleware
app.use((0, cors_1.default)({
    origin: "*", // your Flutter web dev URL
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true, // if you’re sending cookies or auth headers
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, morgan_1.default)("dev"));
// connect db
app.get("/test-db", async (req, res) => {
    try {
        const result = await db_1.default.query("SELECT NOW()");
        res.json({ message: "Database Connected!", time: result.rows[0] });
        console.log(process.env.DATABASE_URL);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database connection failed" });
    }
});
// test route
app.use("/api/v1/auth", authRoutes_1.default);
app.use("/api/v1/futsal", futsalRoutes_1.default);
app.use("/api/v1/bookings", bookingRoutes_1.default);
app.use("/api/v1/users", userRoutes_1.default);
app.use("/api/v1/notifications", notificationRoutes_1.default);
app.use("/api/v1/payments", paymentRoutes_1.default);
app.use("/api/v1/reviews", reviewRoutes_1.default);
app.get("/", (_req, res) => {
    res.send("Futsal Booking Backend (TypeScript) is running 🚀");
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error("Express Error:", err);
    res.status(err.status || 500).json({
        error: err.message || "Internal Server Error",
        details: process.env.NODE_ENV === "development" ? err : undefined
    });
});
const PORT = process.env.PORT ?? 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
// Global unhandled promise rejection handler
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
// Global uncaught exception handler
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
});
exports.default = app;
