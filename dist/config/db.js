"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Neon requires SSL
});
pool.query('SELECT NOW()')
    .then(() => console.log("✅ Connected to Neon PostgreSQL"))
    .catch((err) => console.error("❌ Database connection error:", err));
pool.on("error", (err) => {
    console.error("❌ Postgres Pool Error (Idle Client):", err.message);
    if (err.stack)
        console.error(err.stack);
    // process.exit(-1); // Prevent crash, let the pool handle reconnection
});
exports.default = pool;
