const express = require("express");
const axios = require('axios');
const { QuillDeltaToHtmlConverter } = require('quill-delta-to-html');

const app = express();
const port = 3000;
const API_URL = "http://localhost:4000";

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());


app.get('/', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
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
    const paginatedPosts = sortedPosts.slice(startIndex, startIndex + limit);

    res.render('index.ejs', {
        posts,
        featuredPost,
        paginatedPosts,
        currentPage: page,
        totalPages
    });
});

app.get('/blogs', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
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
        const paginatedPosts = sortedPosts.slice(startIndex, startIndex + limit);

        res.render('blog_listing.ejs', {
            posts,
            featuredPost,
            paginatedPosts,
            currentPage: page,
            totalPages
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal server error');
    }
});

app.get('/author', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 6;

        const response = await axios.get(`${API_URL}/author/1`) //change dynamically when implementing authentication
        const posts = response.data;

        const totalPosts = posts.length;
        const totalPages = Math.ceil(totalPosts / limit);

        const sortedPosts = [...posts].sort((a, b) =>
            new Date(b.last_updated) - new Date(a.last_updated)
        );

        const startIndex = (page - 1) * limit;
        const paginatedPosts = sortedPosts.slice(startIndex, startIndex + limit);

        res.render('author.ejs', { posts, paginatedPosts, currentPage: page, totalPages });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/new', (req, res) => {
    res.render('create_blog.ejs');
});

app.get('/blog/:id', async (req, res) => {
    try {
        const response = await axios.get(`${API_URL}/posts/${req.params.id}`);
        const post = response.data;
        const deltaOps = post.content.ops;
        const converter = new QuillDeltaToHtmlConverter(deltaOps, {});
        post.contentHtml = converter.convert();
        res.render('single_blog.ejs', { post });
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

app.get('/modify/:id', async (req, res) => {
    try {
        const response = await axios.get(`${API_URL}/posts/${req.params.id}`);
        const post = response.data;
        const deltaOps = post.content.ops;
        const converter = new QuillDeltaToHtmlConverter(deltaOps, {});
        post.contentHtml = converter.convert();
        console.log(post.comments);
        res.render('create_blog.ejs', { post });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal server error");
    }
});

app.get('/delete/:id', async (req, res) => {
    try {
        await axios.delete(`${API_URL}/posts/${req.params.id}`);
        res.redirect('/author');
    } catch (error) {
        console.error(error);
        res.status(500).send("Error deleting post");
    }
});

app.get('/comment/delete/:blogId/:commentId', async (req, res) => {
    try {
        await axios.delete(`${API_URL}/comments/${parseInt(req.params.commentId)}`);
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

app.get('/reply/delete/:blogId/:replyId', async (req, res) => {
    try {
        await axios.delete(`${API_URL}/reply/${parseInt(req.params.replyId)}`);
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

app.post('/api/post', async (req, res) => {
    try {
        const response = await axios.post(`${API_URL}/posts`, req.body);
        console.log(response.data);
        res.redirect('/');
    } catch (error) {
        res.status(500).json({ message: 'Error creating post' });
    }
});

app.post('/api/edit/:id', async (req, res) => {
    try {
        await axios.patch(`${API_URL}/posts/${req.params.id}`, req.body);
        res.redirect('/author');
    } catch (error) {
        res.status(500).json({ message: 'Error Updating BlogPost' });
    }
});

app.post('/api/comment', async (req, res) => {
    try {
        const response = await axios.post(`${API_URL}/comment`, req.body);
        console.log(response.data);
        res.redirect(`/blog/${req.body.blog_id}`);
    } catch (error) {
        res.status(500).json({ message: 'Error creating a comment' });
    }
});

app.post('/api/reply', async (req, res) => {
    try {
        const response = await axios.post(`${API_URL}/reply`, req.body);
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
        res.render('single_blog.ejs', { post: post, editingComment: commentToEdit });
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
        res.render('single_blog.ejs', { post: post, editingReply: replyToEdit });
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

app.post('/api/comment/modify/:id', async (req, res) => {
    try {
        const blogId = req.body.blog_id;
        if (!blogId) {
            console.error("Blog ID missing from form submission");
            return res.status(400).send("Error: Blog ID not provided in form");
        }
        const commentId = parseInt(req.params.id);
        await axios.patch(`${API_URL}/comment/${commentId}`, req.body);
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

app.post('/api/reply/modify/:id', async (req, res) => {
    try {
        const blogId = req.body.blog_id;
        if (!blogId) {
            console.error("Blog Id Missing from form submission");
            return res.status(400).send('Error:Blog ID not provided in form');
        }
        const replyId = parseInt(req.params.id);
        await axios.patch(`${API_URL}/reply/${replyId}`, req.body);
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

app.post('/api/like', async (req, res) => {
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
            headers: { "Content-Type": "application/json" },
        });

        res.json(response.data);
    } catch (error) {
        console.error("Error forwarding request", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

app.listen(port, () => {
    console.log(`Running on http://localhost:${port}`)
});