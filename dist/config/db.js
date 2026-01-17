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
    max: 10, // Limit connections on free tier
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
});
// Better logging for the initial connection
pool.connect((err, client, release) => {
    if (err) {
        console.error("❌ Database connection failed at startup:", err.stack);
    }
    else {
        console.log("✅ Successfully connected to Neon PostgreSQL");
        release();
    }
});
pool.on("error", (err) => {
    console.error("❌ Postgres Pool Error (Idle Client):", err.message);
    // Do not process.exit(-1); - allows the pool to create new clients
});
exports.default = pool;
