const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const env = require('dotenv');
const { Pool } = require('pg');

env.config();

const connectionPool = new Pool({
    max: 5,
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

let isPoolClosed = false;


passport.use(new LocalStrategy(async function verify(username, password, cb) {
    const client = await connectionPool.connect();
    try {
        const result = await client.query("SELECT * FROM users WHERE name = $1", [username]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            bcrypt.compare(password, user.password, (err, result) => {
                if (err) {
                    return cb(err);
                }
                else {
                    if (result) {
                        return cb(null, user);
                    } else {
                        return cb(null, false);
                    }
                }
            });
        } else {
            return cb("User not found");
        }
    } catch (error) {
        return cb(error);
    } finally {
        client.release();
    }
}));

passport.serializeUser((user, cb) => {
    cb(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    const client = await connectionPool.connect();
    try {
        const result = await client.query("SELECT * FROM users WHERE id=$1", [id]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            done(null, user);
        } else {
            console.log(`deserializeUser: User not found (id: ${id})`);
            done(null, false);
        }
    } catch (err) {
        done(err, null);
    } finally {
        client.release();
    }
});

const requireAuth = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.render('login.ejs');
};

const requireAdmin = async (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Authentication required.' });
    }
    const client = await connectionPool.connect();
    try {
        const result = await client.query("SELECT 1 FROM admins WHERE user_id = $1 LIMIT 1", [req.user.id]);
        if (result.rows.length > 0) {
            return next();
        } else {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }
    } catch (err) {
        console.error('Error checking admin rights:', err);
        return res.status(500).json({ message: 'Internal server error.' });
    } finally {
        client.release();
    }
};

const authAttempts = new Map();

const rateLimitAuth = (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const maxAttempts = 5;

    if (!authAttempts.has(ip)) {
        authAttempts.set(ip, { count: 1, resetTime: now + windowMs });
        return next();
    }

    const attempts = authAttempts.get(ip);

    if (now > attempts.resetTime) {
        attempts.count = 1;
        attempts.resetTime = now + windowMs;
        return next();
    }

    if (attempts.count >= maxAttempts) {
        return res.status(429).json({
            message: 'Too many authentication attempts. Please try again later.',
            retryAfter: Math.ceil((attempts.resetTime - now) / 1000)
        });
    }

    attempts.count++;
    next();
};

setInterval(() => {
    const now = Date.now();
    for (const [ip, attempts] of authAttempts.entries()) {
        if (now > attempts.resetTime) {
            authAttempts.delete(ip);
        }
    }
}, 10 * 60 * 1000);

process.on('SIGINT', async () => {
    if (!isPoolClosed) {
        console.log('Closing database connection pool...');
        await connectionPool.end();
        isPoolClosed = true;
        console.log('Database connection pool closed.');
    }
    process.exit(0);
});

module.exports = {
    passport,
    requireAuth,
    requireAdmin,
    rateLimitAuth
};