"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});
// Handle connection errors gracefully
prisma.$connect()
    .then(() => {
    console.log('✅ Connected to Neon PostgreSQL (Prisma)');
})
    .catch((error) => {
    console.error('❌ Failed to connect to database (Prisma):', error.message);
    if (error.code === 'P1001') {
        console.error('💡 Tip: Make sure your database server is running and accessible.');
    }
});
// Graceful shutdown
process.on('beforeExit', async () => {
    await prisma.$disconnect();
    console.log('🔌 Disconnected from database');
});
exports.default = prisma;
