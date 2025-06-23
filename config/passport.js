const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth2');
const bcrypt = require('bcrypt');
const env = require('dotenv');
const { connectionPool } = require('../db');

env.config();

passport.use('local', new LocalStrategy(async function verify(username, password, cb) {
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

passport.use('google', new GoogleStrategy(
    {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
        const client = await connectionPool.connect();
        try {
            let result = await client.query("SELECT * FROM users WHERE google_id=$1", [profile.id]);
            let user = result.rows[0];

            if (user) {
                return done(null, user);
            }

            // Create new user
            const insertResult = await client.query(
                `INSERT INTO users (name, profile_icon_url, password, google_id)
                VALUES ($1, $2, $3,$4)
                RETURNING *`,
                [profile.displayName, profile.photos[0].value, 'google', profile.id]
            );

            const newUser = insertResult.rows[0];
            return done(null, newUser);

        } catch (error) {
            return done(error, null);
        }
    }
));

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

module.exports = {
    passport,
    requireAuth,
    requireAdmin,
    rateLimitAuth
};