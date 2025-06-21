const express = require('express');
const passport = require('passport');
const bcrypt = require('bcrypt');
const { rateLimitAuth } = require('../config/passport');
const router = express.Router();
const { connectionPool } = require('../db');

const saltRounds = 10;

router.post("/register", async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const bio = req.body.bio;
    const client = await connectionPool.connect();
    try {
        const result = await client.query('SELECT * FROM users WHERE name=$1', [username]);
        if (result.rows.length > 0) {
            return res.status(400).send("Username already exists, try logging in");
        }
        const hash = await bcrypt.hash(password, saltRounds);

        const result2 = await client.query("INSERT INTO users(name,profile_icon_url,password,bio) values($1,$2,$3,$4) RETURNING *;", [username, `/images/default_profile.png`, hash, bio]);
        const user = result2.rows[0];

        req.login(user, (err) => {
            if (err) {
                return res.status(500).json({
                    message: 'Registration successful but login failed'
                });
            }

            res.status(201).json({
                message: 'User created and logged in successfully',
                user: {
                    id: user.id,
                    username: user.name,
                    bio: user.bio
                }
            });
        });

    } catch (error) {
        console.error("Error executing query", error.stack);
    } finally {
        client.release();
    }
});

/*router.post('/login', rateLimitAuth, passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
}));*/
router.post('/login', rateLimitAuth, (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);
        if (!user) return res.status(401).json({ message: info?.message || 'Login failed' });

        req.login(user, (err) => {
            if (err) return res.status(500).json({ message: 'Login failed during session creation' });
            res.status(200).json({
                message: 'Login successful',
                user: {
                    id: user.id,
                    username: user.name,
                    bio: user.bio
                }
            });
        });
    })(req, res, next);
});

router.post('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ message: 'Logout failed' });
        }
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ message: 'Session destruction failed' });
            }
            res.clearCookie('connect.sid');
            res.json({ message: 'Logged out successfully' });
        });
    });
});

router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
    passport.authenticate('google', {
        successRedirect: '/',
        failureRedirect: '/login'
    })
);

// Alternative Google callback with JSON response
router.get('/google/callback/json',
    passport.authenticate('google'),
    (req, res) => {
        res.json({
            message: 'Google authentication successful',
            user: {
                id: req.user.id,
                username: req.user.name,
                googleId: req.user.google_id,
                profile_icon_url: req.user.profile_icon_url
            }
        });
    }
);

module.exports = router;