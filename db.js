const env = require('dotenv');
env.config();
const { Pool } = require("pg");

const connectionPool = new Pool({
    max: 5,
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    }
});

let poolEnded = false;

async function safeEndPool() {
    if (poolEnded) return;
    poolEnded = true;
    await connectionPool.end();
}

module.exports = { connectionPool, safeEndPool, };