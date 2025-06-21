const express = require("express");
const { connectionPool } = require('./db');
const { requireAuth, requireAdmin, rateLimitAuth } = require('./config/passport');

const env = require('dotenv');

env.config();

const app = express();
const port = 4000;
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use((err, req, res, next) => {
    if (err.status === 413) {
        return res.status(413).json({ error: "Request too large! Try reducing content size." });
    }
    next();
});
app.set('trust proxy', true);

async function getAllBlogs() {
    const client = await connectionPool.connect();
    try {
        const result = await client.query("SELECT blog.id AS blog_id,blog.banner_image_url, blog.title, blog.content, blog.published_on, blog.creation_date, blog.last_updated, blog.is_draft, users.id AS author_id,users.name AS author_name, STRING_AGG(DISTINCT tag.tag_name, ', ') AS tags, COUNT(DISTINCT blog_like.id) AS blog_likes_count, COUNT(DISTINCT comment.id) AS total_comments, COUNT(DISTINCT comment_like.id) AS total_comment_likes, JSON_AGG( DISTINCT JSONB_BUILD_OBJECT( 'comment_id', comment.id, 'comment_text', comment.text,'commented_by_id',comment_users.id, 'commented_by', comment_users.name,'commented_by_profile',comment_users.profile_icon_url, 'commented_on', comment.creation_date, 'comment_likes', ( SELECT COUNT(*) FROM comment_like WHERE comment_like.comment_id = comment.id ), 'replies',( SELECT COALESCE ( JSON_AGG( JSONB_BUILD_OBJECT( 'reply_id',r.id, 'reply_text',r.text,'replied_by_id',ru.id, 'replied_by',ru.name,'replied_by_profile',ru.profile_icon_url, 'replied_on',r.last_updated,'parent_reply_id', r.parent_reply_id,'replying_to',(SELECT rpu.name FROM reply pr JOIN users rpu ON pr.user_id=rpu.id WHERE pr.id = r.parent_reply_id),'reply_likes',( SELECT COUNT(*) FROM reply_like WHERE reply_like.reply_id = r.id ) ) ) FILTER (WHERE r.id IS NOT NULL), '[]'::json ) FROM reply r JOIN users ru ON r.user_id = ru.id WHERE r.comment_id = comment.id ) ) ) FILTER (WHERE comment.id IS NOT NULL) AS comments FROM blog JOIN users ON blog.by_user = users.id LEFT JOIN blog_like ON blog.id = blog_like.blog_id LEFT JOIN comment ON blog.id = comment.blog_id LEFT JOIN users AS comment_users ON comment.user_id = comment_users.id LEFT JOIN comment_like ON comment.id = comment_like.comment_id LEFT JOIN blog_tag ON blog.id = blog_tag.blog_id LEFT JOIN tag ON blog_tag.tag_id = tag.id GROUP BY blog.id, users.name,users.id;");
        return result.rows;
    } catch (error) {
        console.error("Error executing query", error.stack);
        return [];
    }
    finally {
        client.release();
    }
}

app.get('/posts', async (req, res) => {
    try {
        const blogs = await getAllBlogs();
        res.json(blogs);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get('/posts/:id', async (req, res) => {
    try {
        const index = parseInt(req.params.id);
        const blogs = await getAllBlogs();
        const blog = blogs.find((post) => post.blog_id === index);
        if (!blog) {
            console.log(`Blog ${index} not found in ${blogs.length} available blogs`);
            return res.status(404).json({ message: "Blog not found" });
        }
        res.json(blog);
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

app.get('/author/:id', async (req, res) => {
    const client = await connectionPool.connect();
    try {
        const author_id = parseInt(req.params.id);
        const blogs = await client.query("SELECT blog.id AS blog_id,blog.banner_image_url,blog.title,blog.is_draft,blog.last_updated,blog.by_user,users.id AS author_id,users.name,users.profile_icon_url,users.bio,STRING_AGG(tag.tag_name,', ') AS tags FROM blog LEFT JOIN users ON blog.by_user=users.id LEFT JOIN blog_tag ON blog.id = blog_tag.blog_id LEFT JOIN tag ON blog_tag.tag_id = tag.id WHERE blog.by_user = $1 GROUP BY blog.id,users.id,users.name,users.profile_icon_url,users.bio", [author_id]);
        res.json(blogs.rows);
    } catch (error) {
        console.error("Error executing query", error.stack);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

app.get('/user/:id', async (req, res) => {
    const client = await connectionPool.connect();
    try {
        const user_id = parseInt(req.params.id);
        const result = await client.query("SELECT * FROM users WHERE id=$1", [user_id]);
        res.json(result.rows);
    } catch (error) {
        console.error("Error executing query", error.stack);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

app.post('/profile', async (req, res) => {
    const client = await connectionPool.connect();
    const userId = req.body.userId;
    if (!userId) {
        return res.status(400).json({ error: "User id missing" });
    }
    try {
        const result = await client.query("UPDATE users SET profile_icon_url = $1 WHERE id = $2", [req.body.profile_icon_url, userId]);
        return res.status(200).json({
            message: 'Profile picture Updated Successfully'
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

app.post("/add-bio", async (req, res) => {
    const client = await connectionPool.connect();
    const userId = req.body.userId;
    if (!userId) {
        return res.status(400).json({ error: "User Id Missing" });
    }
    try {
        const result = await client.query("UPDATE users SET bio = $1 WHERE id = $2", [req.body.bio, userId]);
        return res.status(200).json({
            message: 'User Bio Added Successfully'
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

app.post("/update-name", async (req, res) => {
    const client = await connectionPool.connect();
    const userId = req.body.userId;
    if (!userId) {
        return res.status(400).json({ error: "User Id Missing" });
    }
    try {
        const result = await client.query("UPDATE users SET name = $1 WHERE id = $2", [req.body.name, userId]);
        return res.status(200).json({
            message: 'User Name Updated Successfully'
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

app.post('/check-likes', async (req, res) => {
    const client = await connectionPool.connect();
    const userId = req.body.id;
    if (!userId) {
        return res.status(400).json({ error: "User ID missing" });
    }
    try {
        const result = await client.query("SELECT blog_id FROM blog_like WHERE user_id=$1", [userId]);
        const commentLikes = await client.query("SELECT comment_id from comment_like WHERE user_id=$1", [userId]);
        const replyLikes = await client.query("SELECT reply_id FROM reply_like WHERE user_id =$1", [userId]);
        res.json({ blogLikes: result.rows.map(row => row.blog_id), commentLikes: commentLikes.rows.map(row => row.comment_id), replyLikes: replyLikes.rows.map(row => row.reply_id), });
    } catch (err) {
        console.error("Error executing query", err.stack);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        client.release();
    }
});

app.post('/posts', async (req, res) => {
    const author_id = req.body.id;
    const tags = req.body.blogTags.split(',').map(tag => tag.trim());
    let is_draft = req.body.createButton === 'create' ? false : true;
    const client = await connectionPool.connect();
    try {
        const blogInsertResult = await client.query('INSERT INTO blog (banner_image_url,title,content,is_draft,published_on,creation_date,last_updated,by_user) VALUES ($1,$2,$3,$4,NOW(),NOW(),NOW(),$5) RETURNING id', [req.body.blogBanner || `/images/default_banner.png`, req.body.blogTitle, req.body.blogContent, is_draft, author_id]);
        const blog_id = blogInsertResult.rows[0].id;
        for (const tag of tags) {
            const tagResult = await client.query('INSERT INTO tag (tag_name) SELECT CAST($1 AS VARCHAR) WHERE NOT EXISTS (SELECT 1 FROM tag WHERE tag_name=$1) RETURNING id;', [tag]);
            let tag_id;
            if (tagResult.rows.length > 0) {
                tag_id = tagResult.rows[0].id;
            } else {
                const existingTag = await client.query('SELECT id FROM tag WHERE tag_name = $1', [tag]);
                tag_id = existingTag.rows[0].id;
            }
            await client.query('INSERT INTO blog_tag (blog_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [blog_id, tag_id]);
        }
        res.status(201).json({ message: 'Blog post created successfully' });
    } catch (error) {
        console.error('Error creating BlogPost', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

app.post('/reply', async (req, res) => {
    const authorName = req.body.username;
    const client = await connectionPool.connect();
    const replyText = req.body.reply_text;
    const commentId = req.body.comment_id;
    const parentReplyId = req.body.parent_reply_id || null;
    try {
        const authorResult = await client.query("SELECT id FROM users WHERE name=$1", [authorName]);
        if (authorResult.rows.length === 0) {
            console.error("❌ Author not found in database!");
            return res.status(400).json({ error: "Author not found" });
        }
        const authorId = authorResult.rows[0].id;
        await client.query("INSERT INTO reply(text,comment_id,user_id,parent_reply_id) VALUES ($1,$2,$3,$4)", [replyText, commentId, authorId, parentReplyId]);
        res.status(201).json({ message: 'Reply Added successfully' });
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

app.post('/comment', async (req, res) => {
    const author_name = req.body.username;
    const client = await connectionPool.connect();
    const comment_text = req.body.commentText;
    const blog_id = req.body.blog_id;
    try {
        const authorResult = await client.query('SELECT id from users WHERE name=$1', [author_name]);
        if (authorResult.rows.length === 0) {
            console.error("❌ Author not found in database!");
            return res.status(400).json({ error: "Author not found" });
        }
        const author_id = authorResult.rows[0].id;
        await client.query('INSERT INTO comment(text,user_id,blog_id) VALUES($1,$2,$3)', [comment_text, author_id, blog_id]);
        res.status(201).json({ message: 'Comment Added successfully' });
    } catch (error) {
        console.error('Error Writing Comment', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        client.release();
    }
});

app.post('/reply_like', async (req, res) => {
    const userId = req.body.user.id;
    const replyId = req.body.reply_id;
    const client = await connectionPool.connect();
    try {
        const likeCheck = await client.query("SELECT * FROM reply_like WHERE user_id = $1 AND reply_id = $2", [userId, replyId]);
        if (likeCheck.rows.length > 0) {
            await client.query("DELETE FROM reply_like WHERE user_id =$1 AND reply_id = $2", [userId, replyId]);
            res.json({ message: 'Like removed', liked: false });
        }
        else {
            await client.query("INSERT INTO reply_like(user_id,reply_id) VALUES ($1, $2)", [userId, replyId]);
            res.json({ message: 'reply liked', liked: true });
        }
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

app.post('/blog_like', async (req, res) => {
    const user_id = req.body.user.id;
    const post_id = req.body.post_id;
    const client = await connectionPool.connect();
    try {
        const like_check = await client.query('SELECT * FROM blog_like WHERE user_id=$1 AND blog_id = $2', [user_id, post_id]);
        if (like_check.rows.length > 0) {
            await client.query('DELETE FROM blog_like WHERE user_id = $1 AND blog_id=$2', [user_id, post_id]);
            res.json({ message: 'Like removed', liked: false });
        } else {
            await client.query('INSERT INTO blog_like(user_id,blog_id) VALUES($1,$2)', [user_id, post_id]);
            res.json({ message: 'post liked', liked: true });
        }
    } catch (error) {
        console.error('Error liking post', error);
        res.status(500).json({ message: 'Internal Server Error' });
    } finally {
        client.release();
    }
});

app.post('/comment_like', async (req, res) => {
    const user_id = req.body.user.id;
    const comment_id = req.body.comment_id;
    const client = await connectionPool.connect();
    try {
        const like_check = await client.query("SELECT * FROM comment_like WHERE user_id=$1 AND comment_id=$2", [user_id, comment_id]);
        if (like_check.rows.length > 0) {
            await client.query("DELETE FROM comment_like WHERE user_id=$1 AND comment_id =$2", [user_id, comment_id]);
            res.json({ message: "Comment like removed", liked: false });
        }
        else {
            await client.query("INSERT INTO comment_like(user_id,comment_id) VALUES ($1,$2)", [user_id, comment_id]);
            res.json({ message: 'Comment Liked', liked: true });
        }
    } catch (error) {
        console.error("Error Liking Comment", error);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
});

app.patch('/posts/:id', async (req, res) => {
    const index = parseInt(req.params.id);
    const client = await connectionPool.connect();
    try {
        const existingBlog = await client.query("SELECT blog.banner_image_url,blog.title,blog.content, STRING_AGG(tag.tag_name,',') AS tags FROM blog LEFT JOIN blog_tag on blog.id=blog_tag.blog_id LEFT JOIN tag on blog_tag.tag_id=tag.id WHERE blog.id=$1 GROUP BY blog.id;", [index]);
        if (existingBlog.rows.length === 0) {
            return res.status(404).json({ error: "Blog not found" });
        }
        const existingBanner = existingBlog.rows[0].banner_image_url;
        const existingTitle = existingBlog.rows[0].title;
        const existingContent = existingBlog.rows[0].content;
        const newBanner = req.body.banner || existingBanner;
        const newTitle = req.body.title || existingTitle;
        const newContent = req.body.content || existingContent;
        let is_draft = req.body.createButton === 'create' ? false : true;
        await client.query('UPDATE blog SET banner_image_url =$1, title = $2, content = $3,is_draft=$4, last_updated = NOW() WHERE id = $5', [newBanner, newTitle, newContent, is_draft, index]);
        if (req.body.tags) {
            const newTags = req.body.tags.split(',').map(tag => tag.trim());
            await client.query('DELETE FROM blog_tag WHERE blog_id = $1', [index]);
            for (const tag of newTags) {
                const tagResult = await client.query('INSERT INTO tag (tag_name) SELECT CAST($1 AS VARCHAR) WHERE NOT EXISTS (SELECT 1 FROM tag WHERE tag_name=$1) RETURNING id;', [tag]);
                let tag_id;
                if (tagResult.rows.length > 0) {
                    tag_id = tagResult.rows[0].id;
                } else {
                    const existingTag = await client.query('SELECT id FROM tag WHERE tag_name = $1', [tag]);
                    tag_id = existingTag.rows[0].id;
                }
                await client.query('INSERT INTO blog_tag (blog_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [index, tag_id]);
            }
        }
        res.status(201).json({ message: 'Blog Updated successfully' });
    } catch (error) {
        console.error('Error Updating Blogpost');
        res.status(500).json({ error: 'Internal server Error' });
    } finally {
        client.release();
    }
});

app.patch('/comment/:id', async (req, res) => {
    const index = parseInt(req.params.id);
    const client = await connectionPool.connect();
    try {
        const existingComment = await client.query("SELECT * FROM comment WHERE id=$1", [index]);
        if (existingComment.rows.length === 0) {
            return res.status(404).json({ error: "Comment not found" });
        }
        const existingText = existingComment.rows[0].text;
        const modifiedText = req.body.commentText || existingText;
        await client.query("UPDATE comment SET text = $1, last_updated = NOW() WHERE id = $2", [modifiedText, index]);
        return res.status(200).json({
            message: 'Comment Updated Successfully'
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

app.patch('/reply/:id', async (req, res) => {
    const index = parseInt(req.params.id);
    const client = await connectionPool.connect();
    try {
        const existingReply = await client.query("SELECT * FROM reply WHERE id=$1", [index]);
        if (existingReply.rows.length === 0) {
            return res.status(404).json({ error: 'Reply not found' });
        }
        const existingText = existingReply.rows[0].text;
        const modifiedText = req.body.replyText || existingText;
        await client.query("UPDATE reply SET text = $1, last_updated = NOW() WHERE id = $2 ", [modifiedText, index]);
        return res.status(200).json({
            message: 'Reply Updated Successfully'
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

app.delete('/posts/:id', async (req, res) => {
    const index = parseInt(req.params.id);
    const client = await connectionPool.connect();
    try {
        await client.query('DELETE FROM blog WHERE id = $1', [index]);
        res.sendStatus(200);
    } catch (error) {
        res.status(404).json({ error: `Blogs with id ${index} were not found noblogs  were deleted` })
    } finally {
        client.release();
    }
});

app.delete('/comments/:id', async (req, res) => {
    const index = parseInt(req.params.id);
    const client = await connectionPool.connect();
    try {
        await client.query('DELETE FROM comment WHERE id = $1', [index]);
        res.sendStatus(200);
    } catch (error) {
        res.status(404).json({ error: `Comment with id ${index} was not found, no comments were deleted` });
    } finally {
        client.release();
    }
});

app.delete('/reply/:id', async (req, res) => {
    const index = parseInt(req.params.id);
    const client = await connectionPool.connect();
    try {
        await client.query("DELETE FROM reply WHERE id= $1", [index]);
        res.sendStatus(200);
    } catch (error) {
        res.status(404).json({ error: `Reply with id ${index} was not found hence was not deleted` });
    } finally {
        client.release();
    }
});

app.listen(port, () => {
    console.log(`API is running on http://localhost:${port}`);
});