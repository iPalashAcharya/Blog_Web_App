const env = require('dotenv');
env.config();
const { Pool } = require("pg");

const connectionPool = new Pool({
    max: 5,
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
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