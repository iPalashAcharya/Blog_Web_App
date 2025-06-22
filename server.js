const express = require("express");
const axios = require('axios');
const session = require('express-session');
const { passport } = require('./config/passport');
const pgSession = require('connect-pg-simple')(session);
const { connectionPool, safeEndPool } = require('./db');
const authRoutes = require('./routes/auth');
const { QuillDeltaToHtmlConverter } = require('quill-delta-to-html');
const env = require('dotenv');
const { requireAuth, requireAdmin, rateLimitAuth } = require('./config/passport');

env.config();

const app = express();
const port = 3000;
const API_URL = "http://localhost:4000";

app.set('trust proxy', true);
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    store: new pgSession({
        pool: connectionPool,
        tableName: 'session',
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', authRoutes);

app.get('/', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 6;

    const response = await axios.get(`${API_URL}/posts`);
    const posts = response.data;

    const publishedPosts = posts.filter(post => !post.is_draft);
    const sortedPosts = [...publishedPosts].sort((a, b) =>
        new Date(b.creation_date) - new Date(a.creation_date)
    );

    const featuredPost = sortedPosts[0];
    const remainingPosts = sortedPosts.filter(post => post.blog_id !== featuredPost.blog_id);

    const totalPosts = remainingPosts.length;
    const totalPages = Math.ceil(totalPosts / limit);

    const startIndex = (page - 1) * limit;
    const paginatedPosts = remainingPosts.slice(startIndex, startIndex + limit);

    res.render('index.ejs', {
        featuredPost,
        paginatedPosts,
        currentPage: page,
        totalPages,
        user: req.user
    });
});

app.get('/login', async (req, res) => {
    res.render('login.ejs');
});

app.get('/blogs', async (req, res) => {
    try {
        /*const page = parseInt(req.query.page) || 1;
        const limit = 6;

        const response = await axios.get(`${API_URL}/posts`);
        const posts = response.data;

        const featuredPost = posts[posts.length - 1];
        const remainingPosts = posts.slice(0, posts.length - 1);

        const totalPosts = remainingPosts.length;
        const totalPages = Math.ceil(totalPosts / limit);

        const sortedPosts = [...remainingPosts].sort((a, b) =>
            new Date(b.last_updated) - new Date(a.last_updated)
        );

        const startIndex = (page - 1) * limit;
        const paginatedPosts = sortedPosts.slice(startIndex, startIndex + limit);*/
        const page = parseInt(req.query.page) || 1;
        const limit = 6;

        const response = await axios.get(`${API_URL}/posts`);
        const posts = response.data;

        const publishedPosts = posts.filter(post => !post.is_draft);
        const sortedPosts = [...publishedPosts].sort((a, b) =>
            new Date(b.creation_date) - new Date(a.creation_date)
        );

        const featuredPost = sortedPosts[0];
        const remainingPosts = sortedPosts.filter(post => post.blog_id !== featuredPost.blog_id);

        const totalPosts = remainingPosts.length;
        const totalPages = Math.ceil(totalPosts / limit);

        const startIndex = (page - 1) * limit;
        const paginatedPosts = remainingPosts.slice(startIndex, startIndex + limit);

        res.render('blog_listing.ejs', {
            featuredPost,
            paginatedPosts,
            currentPage: page,
            totalPages,
            user: req.user || null
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal server error');
    }
});

app.get('/author/:id', requireAuth, async (req, res) => {
    try {
        const type = req.query.type || 'post';
        const page = parseInt(req.query.page) || 1;
        const limit = 6;
        const userId = req.params.id;

        const response = await axios.get(`${API_URL}/author/${userId}`, { withCredentials: true, headers: { Cookie: req.headers.cookie } });
        const posts = response.data;

        const response2 = await axios.get(`${API_URL}/user/${userId}`, { withCredentials: true, headers: { Cookie: req.headers.cookie } });
        const user = response2.data[0];

        const draftPosts = posts.filter(blog => blog.is_draft === true);
        const publishedPosts = posts.filter(blog => blog.is_draft === false);

        const totalDraftPages = Math.ceil(draftPosts.length / limit);
        const totalPostPages = Math.ceil(publishedPosts.length / limit);

        const sortedDraftPosts = [...draftPosts].sort((a, b) =>
            new Date(b.creation_date) - new Date(a.creation_date)
        );
        const sortedPublishedPosts = [...publishedPosts].sort((a, b) =>
            new Date(b.creation_date) - new Date(a.creation_date)
        );

        const startIndex = (page - 1) * limit;

        const paginatedPublishedPosts = sortedPublishedPosts.slice(startIndex, startIndex + limit);
        const paginatedDraftPosts = sortedDraftPosts.slice(startIndex, startIndex + limit);

        res.render('author.ejs', { paginatedPosts: paginatedPublishedPosts, currentPage: page, totalPostPages, publicUser: user, loggedInUser: req.user, totalDraftPages, paginatedDraftPosts, activeType: type });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/new', requireAuth, (req, res) => {
    res.render('create_blog.ejs', { user: req.user });
});

app.get('/blog/:id', async (req, res) => {
    try {
        const response = await axios.get(`${API_URL}/posts/${req.params.id}`);
        const post = response.data;
        const deltaOps = post.content.ops;
        const converter = new QuillDeltaToHtmlConverter(deltaOps, {});
        post.contentHtml = converter.convert();
        if (req.user && req.user.id) {
            const response2 = await axios.post(`${API_URL}/check-likes`, {}, { headers: { 'Content-Type': 'application/json', Cookie: req.headers.cookie }, timeout: 3000 },);
            const likedBlogs = response2.data.blogLikes;
            const blogLiked = likedBlogs.includes(parseInt(req.params.id));
            req.user.blogLiked = blogLiked;
            req.user.commentLiked = response2.data.commentLikes;
            req.user.replyLiked = response2.data.replyLikes;
        }
        res.render('single_blog.ejs', { post, user: req.user || null });
    } catch (error) {
        console.error("ERROR:", error.message);
        if (error.response) {
            console.error("RESPONSE DATA:", error.response.data);
            console.error("STATUS:", error.response.status);
        } else {
            console.error("STACK:", error.stack);
        }
        res.status(500).send("Internal Server Error");
    }
});

app.get('/modify/:id', requireAuth, async (req, res) => {
    try {
        const response = await axios.get(`${API_URL}/posts/${req.params.id}`);
        const post = response.data;
        const deltaOps = post.content.ops;
        const converter = new QuillDeltaToHtmlConverter(deltaOps, {});
        post.contentHtml = converter.convert();
        console.log(post.comments);
        res.render('create_blog.ejs', { post, user: req.user });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal server error");
    }
});

app.get('/delete/:id', requireAuth, async (req, res) => {
    try {
        await axios.delete(`${API_URL}/posts/${req.params.id}`, { withCredentials: true, headers: { Cookie: req.headers.cookie } });
        res.redirect(`/author/${req.user.id}`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Error deleting post");
    }
});

app.post('/delete-profile', requireAuth, async (req, res) => {
    const client = await connectionPool.connect();
    try {
        await client.query("DELETE FROM users WHERE id=$1", [req.user.id]);
        req.logout((err) => {
            if (err) {
                return res.status(500).json({ message: 'Logout failed' });
            }
            req.session.destroy((err) => {
                if (err) {
                    return res.status(500).json({ message: 'Session destruction failed' });
                }
                res.clearCookie('connect.sid');
                return res.status(200).json({ message: 'Profile deleted and logged out successfully' });
            });
        });
    } catch (error) {
        console.error("ERROR:", error.message);
        if (error.response) {
            console.error("RESPONSE DATA:", error.response.data);
            console.error("STATUS:", error.response.status);
        } else {
            console.error("STACK:", error.stack);
        }
        res.status(500).send("Internal Server Error");
    } finally {
        client.release();
    }
});

app.get('/comment/delete/:blogId/:commentId', requireAuth, async (req, res) => {
    try {
        await axios.delete(`${API_URL}/comments/${parseInt(req.params.commentId)}`, { withCredentials: true, headers: { Cookie: req.headers.cookie } });
        res.redirect(`/blog/${parseInt(req.params.blogId)}`);
    } catch (error) {
        console.error("ERROR:", error.message);
        if (error.response) {
            console.error("RESPONSE DATA:", error.response.data);
            console.error("STATUS:", error.response.status);
        } else {
            console.error("STACK:", error.stack);
        }
        res.status(500).send("Internal Server Error");
    }
});

app.get('/reply/delete/:blogId/:replyId', requireAuth, async (req, res) => {
    try {
        await axios.delete(`${API_URL}/reply/${parseInt(req.params.replyId)}`, { withCredentials: true, headers: { Cookie: req.headers.cookie } });
        res.redirect(`/blog/${parseInt(req.params.blogId)}`);
    } catch (error) {
        console.error("ERROR:", error.message);
        if (error.response) {
            console.error("RESPONSE DATA:", error.response.data);
            console.error("STATUS:", error.response.status);
        } else {
            console.error("STACK:", error.stack);
        }
        res.status(500).send("Internal Server Error");
    }
});

app.post('/api/profile', requireAuth, async (req, res) => {
    try {
        const result = await axios.post(`${API_URL}/profile`, req.body, { withCredentials: true, headers: { Cookie: req.headers.cookie } });
        return res.status(result.status).json(result.data);
    } catch (error) {
        console.error("ERROR:", error.message);
        if (error.response) {
            console.error("RESPONSE DATA:", error.response.data);
            console.error("STATUS:", error.response.status);
        } else {
            console.error("STACK:", error.stack);
        }
        res.status(500).send("Internal Server Error");
    }
});

app.post('/api/add-bio', requireAuth, async (req, res) => {
    try {
        const result = await axios.post(`${API_URL}/add-bio`, req.body, { withCredentials: true, headers: { Cookie: req.headers.cookie } });
        return res.status(result.status).json(result.data);
    } catch (error) {
        console.error("ERROR:", error.message);
        if (error.response) {
            console.error("RESPONSE DATA:", error.response.data);
            console.error("STATUS:", error.response.status);
        } else {
            console.error("STACK:", error.stack);
        }
        res.status(500).send("Internal Server Error");
    }
});

app.post('/api/update-name', requireAuth, async (req, res) => {
    try {
        const result = await axios.post(`${API_URL}/update-name`, req.body, { withCredentials: true, headers: { Cookie: req.headers.cookie } });
        return res.status(result.status).json(result.data);
    } catch (error) {
        console.error("ERROR:", error.message);
        if (error.response) {
            console.error("RESPONSE DATA:", error.response.data);
            console.error("STATUS:", error.response.status);
        } else {
            console.error("STACK:", error.stack);
        }
        res.status(500).send("Internal Server Error");
    }
});

app.post('/api/post', requireAuth, async (req, res) => {
    try {
        const response = await axios.post(`${API_URL}/posts`, req.body, { withCredentials: true, headers: { Cookie: req.headers.cookie } });
        console.log(response.data);
        res.redirect('/');
    } catch (error) {
        res.status(500).json({ message: 'Error creating post' });
    }
});

app.post('/api/edit/:id', requireAuth, async (req, res) => {
    try {
        await axios.patch(`${API_URL}/posts/${req.params.id}`, req.body, { withCredentials: true, headers: { Cookie: req.headers.cookie } });
        res.redirect(`/author/${req.user.id}`);
    } catch (error) {
        res.status(500).json({ message: 'Error Updating BlogPost' });
    }
});

app.post('/api/comment', requireAuth, async (req, res) => {
    try {
        await axios.post(`${API_URL}/comment`, req.body, { withCredentials: true, headers: { Cookie: req.headers.cookie } });
        res.redirect(`/blog/${req.body.blog_id}`);
    } catch (error) {
        res.status(500).json({ message: 'Error creating a comment' });
    }
});

app.post('/api/reply', requireAuth, async (req, res) => {
    try {
        await axios.post(`${API_URL}/reply`, req.body, { withCredentials: true, headers: { Cookie: req.headers.cookie } });
        res.redirect(`/blog/${req.body.blog_id}`);
    } catch (error) {
        res.status(500).json({ message: 'Error Replying' });
    }
});

app.get('/comment/modify/:blogId/:commentId', async (req, res) => {
    try {
        const response = await axios.get(`${API_URL}/posts/${req.params.blogId}`);
        const post = response.data;
        const deltaOps = post.content.ops;
        const converter = new QuillDeltaToHtmlConverter(deltaOps, {});
        post.contentHtml = converter.convert();
        const commentToEdit = post.comments.find(
            (c) => c.comment_id === parseInt(req.params.commentId)
        );
        res.render('single_blog.ejs', { post: post, editingComment: commentToEdit, user: req.user });
    } catch (error) {
        console.error("ERROR:", error.message);
        if (error.response) {
            console.error("RESPONSE DATA:", error.response.data);
            console.error("STATUS:", error.response.status);
        } else {
            console.error("STACK:", error.stack);
        }
        res.status(500).send("Internal Server Error");
    }
});

app.get('/reply/modify/:blogId/:replyId', async (req, res) => {
    try {
        let replyToEdit;
        const response = await axios.get(`${API_URL}/posts/${req.params.blogId}`);
        const post = response.data;
        const deltaOps = post.content.ops;
        const converter = new QuillDeltaToHtmlConverter(deltaOps, {});
        post.contentHtml = converter.convert();
        for (const comment of post.comments) {
            for (const reply of comment.replies) {
                if (reply.reply_id === parseInt(req.params.replyId)) {
                    replyToEdit = reply;
                    replyToEdit.comment_id = comment.comment_id;
                }
            }
        }
        res.render('single_blog.ejs', { post: post, editingReply: replyToEdit, user: req.user });
    } catch (error) {
        console.error("ERROR:", error.message);
        if (error.response) {
            console.error("RESPONSE DATA:", error.response.data);
            console.error("STATUS:", error.response.status);
        } else {
            console.error("STACK:", error.stack);
        }
        res.status(500).send("Internal Server Error");
    }
});

app.post('/api/comment/modify/:id', requireAuth, async (req, res) => {
    try {
        const blogId = req.body.blog_id;
        if (!blogId) {
            console.error("Blog ID missing from form submission");
            return res.status(400).send("Error: Blog ID not provided in form");
        }
        const commentId = parseInt(req.params.id);
        await axios.patch(`${API_URL}/comment/${commentId}`, req.body, { withCredentials: true, headers: { Cookie: req.headers.cookie } });
        return res.redirect(`/blog/${blogId}`);
    } catch (error) {
        console.error("ERROR:", error.message);
        if (error.response) {
            console.error("RESPONSE DATA:", error.response.data);
            console.error("STATUS:", error.response.status);
        } else {
            console.error("STACK:", error.stack);
        }
        res.status(500).send("Internal Server Error");
    }
});

app.post('/api/reply/modify/:id', requireAuth, async (req, res) => {
    try {
        const blogId = req.body.blog_id;
        if (!blogId) {
            console.error("Blog Id Missing from form submission");
            return res.status(400).send('Error:Blog ID not provided in form');
        }
        const replyId = parseInt(req.params.id);
        await axios.patch(`${API_URL}/reply/${replyId}`, req.body, { withCredentials: true, headers: { Cookie: req.headers.cookie } });
        return res.redirect(`/blog/${blogId}`);
    } catch (error) {
        console.error("ERROR:", error.message);
        if (error.response) {
            console.error("RESPONSE DATA:", error.response.data);
            console.error("STATUS:", error.response.status);
        } else {
            console.error("STACK:", error.stack);
        }
        res.status(500).send("Internal Server Error");
    }
});

app.post('/api/like', requireAuth, async (req, res) => {
    req.body.user = req.user;
    try {
        let endpoint = null;
        if (req.body.post_id) {
            endpoint = `${API_URL}/blog_like`;
        } else if (req.body.comment_id) {
            endpoint = `${API_URL}/comment_like`;
        }
        else if (req.body.reply_id) {
            endpoint = `${API_URL}/reply_like`
        }

        if (!endpoint) {
            return res.status(400).json({ message: "Invalid request" });
        }

        const response = await axios.post(endpoint, req.body, {
            withCredentials: true,
            headers: { "Content-Type": "application/json", Cookie: req.headers.cookie },
        });

        res.json(response.data);
    } catch (error) {
        console.error("Error forwarding request", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

const server = app.listen(port, () => {
    console.log(`Running on http://localhost:${port}`)
});

process.on('SIGINT', async () => {
    console.log('Gracefully shutting down...');
    server.close(async () => {
        try {
            await safeEndPool();
        } catch (err) {
            console.error('Error closing database pool:', err);
        } finally {
            process.exit(0);
        }
    });
});