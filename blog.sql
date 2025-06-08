CREATE TABLE users (
	id SERIAL PRIMARY KEY,
	name VARCHAR(200),
	profile_icon_url VARCHAR(500) DEFAULT '/images/default_profile.png',
	bio TEXT
);

CREATE TABLE admins (
	id SERIAL PRIMARY KEY,
	user_id INT NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE blog(
	id SERIAL PRIMARY KEY,
	banner_image_url VARCHAR(500) DEFAULT '/images/default_banner.png',
	title TEXT NOT NULL,
	content JSONB NOT NULL,
	is_draft BOOLEAN DEFAULT FALSE,
	published_on TIMESTAMP DEFAULT NOW(),
    creation_date TIMESTAMP DEFAULT NOW(),
    last_updated TIMESTAMP DEFAULT NOW(),
	by_user INT NOT NULL,
	FOREIGN KEY (by_user) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE tag(
	id SERIAL PRIMARY KEY,
	tag_name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE blog_tag(
	id SERIAL PRIMARY KEY,
	blog_id INT NOT NULL,
	tag_id INT NOT NULL,
	FOREIGN KEY (blog_id) REFERENCES blog(id) ON DELETE CASCADE,
	FOREIGN KEY (tag_id) REFERENCES tag(id) ON DELETE CASCADE,
	UNIQUE(blog_id,tag_id)
);

CREATE TABLE comment (
	id SERIAL PRIMARY KEY,
	text TEXT,
	user_id INT NOT NULL,
	creation_date TIMESTAMP DEFAULT NOW(),
    last_updated TIMESTAMP DEFAULT NOW(),
	blog_id INT NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
	FOREIGN KEY (blog_id) REFERENCES blog(id) ON DELETE CASCADE
);

CREATE TABLE blog_like (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    blog_id INT NOT NULL,
    creation_date TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (blog_id) REFERENCES blog(id) ON DELETE CASCADE,
	UNIQUE(user_id,blog_id)
);

CREATE TABLE comment_like (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    comment_id INT NOT NULL,
    creation_date TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES comment(id) ON DELETE CASCADE,
	UNIQUE (user_id,comment_id)
);

CREATE TABLE reply(
	id SERIAL PRIMARY KEY,
	text TEXT NOT NULL,
	comment_id INT NOT NULL,
	user_id INT NOT NULL,
	creation_date TIMESTAMP DEFAULT NOW(),
	last_updated TIMESTAMP DEFAULT NOW(),
	FOREIGN KEY (comment_id) REFERENCES comment(id) ON DELETE CASCADE,
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE reply_like(
	id SERIAL PRIMARY KEY,
	user_id INT NOT NULL,
	reply_id INT NOT NULL,
	creation_date TIMESTAMP DEFAULT NOW(),
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
	FOREIGN KEY (reply_id) REFERENCES reply(id) ON DELETE CASCADE,
	UNIQUE(user_id,reply_id)
);

CREATE TABLE "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid");

CREATE INDEX "IDX_session_expire" ON "session" ("expire");


ALTER TABLE users 
ADD password TEXT;

INSERT INTO reply(text,comment_id,user_id)
VALUES('This is a reply',2,1);

INSERT INTO reply_like(user_id,reply_id)
VALUES(1,1);

INSERT INTO users(name,profile_icon_url,bio)
VALUES('Palash Acharya','/images/default_profile.png','A tech enthusiast');

INSERT INTO admins(user_id)
VALUES(1);

INSERT INTO blog(banner_image_url,title,content,is_draft,published_on,creation_date,last_updated,by_user)
VALUES('/images/default_banner.png','Introduction to Blogging','{"ops":[{"insert":"Welcome to the world of blogging!\n"}]}',FALSE,NOW(),NOW(),NOW(),1);

INSERT INTO blog (banner_image_url, title, content, is_draft, published_on, creation_date, last_updated, by_user)
VALUES
('/images/default_banner.png', 'The Future of Technology', '{"ops":[{"insert":"Let’s talk about upcoming innovations!\n"}]}', FALSE, NOW(), NOW(), NOW(), 1),
('/images/default_banner.png', 'How to Stay Productive', '{"ops":[{"insert":"Productivity tips for daily life.\n"}]}', FALSE, NOW(), NOW(), NOW(), 1),
('/images/default_banner.png', 'Exploring the Cosmos', '{"ops":[{"insert":"Space is fascinating, let’s explore it!\n"}]}', FALSE, NOW(), NOW(), NOW(), 1),
('/images/default_banner.png', 'Healthy Living Habits', '{"ops":[{"insert":"Simple ways to stay fit and healthy.\n"}]}', FALSE, NOW(), NOW(), NOW(), 1),
('/images/default_banner.png', 'Learning a New Language', '{"ops":[{"insert":"Why learning languages is beneficial.\n"}]}', FALSE, NOW(), NOW(), NOW(), 1),
('/images/default_banner.png', 'The Importance of Cybersecurity', '{"ops":[{"insert":"Protect your data from cyber threats.\n"}]}', FALSE, NOW(), NOW(), NOW(), 1);

INSERT INTO tag(tag_name)
VALUES('Writing'),('Technology'),('Lifestyle'),('space'),('linguistics');

INSERT INTO blog_tag(blog_id,tag_id)
VALUES(1,1),(2,2),(3,3),(4,4),(5,3),(6,5),(7,2);

SELECT 
    blog.id AS blog_id,
    blog.title,
    blog.content,
    blog.published_on,
    blog.creation_date,
    blog.last_updated,
    blog.is_draft,
    users.name AS author_name,
    STRING_AGG(tag.tag_name, ', ') AS tags
FROM blog
JOIN users ON blog.by_user = users.id
LEFT JOIN blog_tag ON blog.id = blog_tag.blog_id
LEFT JOIN tag ON blog_tag.tag_id = tag.id
GROUP BY blog.id,users.name;

8 random title [ 'blah', 'blah', 'blah' ] {"ops":[{"insert":"Let’s talk about upcoming innovations!\n"}]}

1 item when /posts :
   {
        "blog_id": 11,
        "title": "Random blog with multiple tags",
        "content": {
            "ops": [
                {
                    "insert": "Let’s talk about upcoming innovations!\n"
                }
            ]
        },
        "published_on": "2025-03-16T16:49:24.464Z",
        "creation_date": "2025-03-16T16:49:24.464Z",
        "last_updated": "2025-03-16T17:02:36.089Z",
        "is_draft": true,
        "author_name": "Palash Acharya",
        "tags": "random1, random2, random3"
    }
author's blogs:
{
        "blog_id": 6,
        "banner_image_url": "/images/default_banner.png",
        "title": "Learning a New Language",
        "is_draft": false,
        "last_updated": "2025-03-13T06:15:20.188Z",
        "by_user": 1,
        "name": "Palash Acharya",
        "profile_icon_url": "/images/default_profile.png",
        "bio": "A tech enthusiast",
        "tags": "linguistics"
    }

SELECT 
    blog.id AS blog_id,
    blog.title,
    blog.content,
    blog.published_on,
    blog.creation_date,
    blog.last_updated,
    blog.is_draft,
    users.name AS author_name,
    STRING_AGG(DISTINCT tag.tag_name, ', ') AS tags,
    COUNT(DISTINCT blog_like.id) AS blog_likes_count,
    COUNT(DISTINCT comment.id) AS total_comments,
    COUNT(DISTINCT comment_like.id) AS total_comment_likes,
    JSON_AGG(
        DISTINCT 
        JSONB_BUILD_OBJECT(
            'comment_id', comment.id,
            'comment_text', comment.text,
            'commented_by', comment_users.name,
            'commented_on', comment.creation_date,
            'comment_likes', (
                SELECT COUNT(*) FROM comment_like 
                WHERE comment_like.comment_id = comment.id
            )
        )
    ) FILTER (WHERE comment.id IS NOT NULL) AS comments
FROM blog
JOIN users ON blog.by_user = users.id
LEFT JOIN blog_like ON blog.id = blog_like.blog_id
LEFT JOIN comment ON blog.id = comment.blog_id
LEFT JOIN users AS comment_users ON comment.user_id = comment_users.id
LEFT JOIN comment_like ON comment.id = comment_like.comment_id
LEFT JOIN blog_tag ON blog.id = blog_tag.blog_id
LEFT JOIN tag ON blog_tag.tag_id = tag.id
GROUP BY blog.id, users.name;

SELECT 
    blog.id AS blog_id,
    blog.title,
    blog.content,
    blog.published_on,
    blog.creation_date,
    blog.last_updated,
    blog.is_draft,
    users.name AS author_name,
    STRING_AGG(DISTINCT tag.tag_name, ', ') AS tags,
    COUNT(DISTINCT blog_like.id) AS blog_likes_count,
    COUNT(DISTINCT comment.id) AS total_comments,
    COUNT(DISTINCT comment_like.id) AS total_comment_likes,
    JSON_AGG(
        DISTINCT 
        JSONB_BUILD_OBJECT(
            'comment_id', comment.id,
            'comment_text', comment.text,
            'commented_by', comment_users.name,
            'commented_on', comment.creation_date,
            'comment_likes', (
                SELECT COUNT(*) FROM comment_like 
                WHERE comment_like.comment_id = comment.id
            ),
			'replies',(
				SELECT COALESCE (
					JSON_AGG(
						JSONB_BUILD_OBJECT(
							'reply_id',r.id,
							'reply_text',r.text,
							'replied_by',ru.name,
							'replied_on',r.last_updated,
							'reply_likes',(
								SELECT COUNT(*) FROM reply_like
								WHERE reply_like.reply_id = r.id
							)
						)
					) FILTER (WHERE r.id IS NOT NULL),
					'[]'::json
				)
				FROM reply r
				JOIN users ru ON r.user_id = ru.id
				WHERE r.comment_id = comment.id
			)
        )
    ) FILTER (WHERE comment.id IS NOT NULL) AS comments
FROM blog
JOIN users ON blog.by_user = users.id
LEFT JOIN blog_like ON blog.id = blog_like.blog_id
LEFT JOIN comment ON blog.id = comment.blog_id
LEFT JOIN users AS comment_users ON comment.user_id = comment_users.id
LEFT JOIN comment_like ON comment.id = comment_like.comment_id
LEFT JOIN blog_tag ON blog.id = blog_tag.blog_id
LEFT JOIN tag ON blog_tag.tag_id = tag.id
GROUP BY blog.id, users.name;

INSERT INTO comment (text, user_id, blog_id) VALUES
('This blog is really insightful!', 1, 1),
('Great points, I completely agree.', 1, 2),
('Can you provide more details on this topic?', 1, 3),
('Looking forward to more content like this!', 1, 1),
('Well-written, thanks for sharing.', 1, 2);

INSERT INTO blog_like (user_id, blog_id) VALUES
(1, 1),
(1, 2),
(1, 3);

INSERT INTO comment_like (user_id, comment_id) VALUES
(1, 1),
(1, 2),
(1, 3),
(1, 4),
(1, 5);

{
        "blog_id": 1,
        "title": "Introduction to Blogging",
        "content": {
            "ops": [
                {
                    "insert": "Welcome to the world of blogging!\n"
                }
            ]
        },
        "published_on": "2025-03-13T06:12:57.467Z",
        "creation_date": "2025-03-13T06:12:57.467Z",
        "last_updated": "2025-03-13T06:12:57.467Z",
        "is_draft": false,
        "author_name": "Palash Acharya",
        "tags": "Writing, Writing",
        "blog_like_count": "1",
        "comment_count": "2",
        "comment_like_count": "2",
        "comments": [
            {
                "comment_id": 1,
                "comment_text": "This blog is really insightful!",
                "commented_by": "Palash Acharya",
                "commented_on": "2025-03-19T18:46:59.664617",
                "comment_likes": 1
            },
            {
                "comment_id": 4,
                "comment_text": "Looking forward to more content like this!",
                "commented_by": "Palash Acharya",
                "commented_on": "2025-03-19T18:46:59.664617",
                "comment_likes": 1
            }
        ]
    },

    [
    {
        "blog_id": 2,
        "title": "The Future of Technology",
        "content": {
            "ops": [
                {
                    "insert": "Let’s talk about upcoming innovations!\n"
                }
            ]
        },
        "published_on": "2025-03-13T06:15:20.188Z",
        "creation_date": "2025-03-13T06:15:20.188Z",
        "last_updated": "2025-03-13T06:15:20.188Z",
        "is_draft": false,
        "author_name": "Palash Acharya",
        "tags": "Technology",
        "blog_likes_count": "1",
        "total_comments": "2",
        "total_comment_likes": "1",
        "comments": [
            {
                "replies": [],
                "comment_id": 5,
                "comment_text": "Well-written, thanks for sharing.",
                "commented_by": "Palash Acharya",
                "commented_on": "2025-03-19T18:46:59.664617",
                "comment_likes": 1
            },
            {
                "replies": [
                    {
                        "reply_id": 5,
                        "replied_by": "Palash Acharya",
                        "replied_on": "2025-04-21T19:55:15.308215",
                        "reply_text": "Random Reply ",
                        "reply_likes": 0
                    },
                    {
                        "reply_id": 4,
                        "replied_by": "Palash Acharya",
                        "replied_on": "2025-04-21T19:40:26.233883",
                        "reply_text": "Random Reply",
                        "reply_likes": 0
                    }
                ],
                "comment_id": 2,
                "comment_text": "Great points, I completely agree.",
                "commented_by": "Palash Acharya",
                "commented_on": "2025-03-19T18:46:59.664617",
                "comment_likes": 0
            }
        ]
    },
{
  id: 1,
  name: 'Palash Acharya',
  profile_icon_url: '/images/default_profile.png',
  bio: 'A tech enthusiast',
  password: '$2b$10$j4CTfTW.pqc0kZtRB5c0wefqT1tVCETCaSXnxGCbk6U78R6WxZnbi'
}