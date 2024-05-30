const express = require('express');
const expressHandlebars = require('express-handlebars');
const session = require('express-session');
const canvas = require('canvas');
const { createCanvas } = require('canvas');
const { register } = require('module');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
require('dotenv').config();

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Configuration and Setup
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const app = express();
const PORT = 3000;
const EMOJI_API_KEY = process.env.EMOJI_API_KEY;

// Set up database with SQLITE
//
const dbFileName = 'microblog.db';
let db;

async function initializeDB() {
    db = await sqlite.open({ filename: dbFileName, driver: sqlite3.Database });
    console.log('Connected to the database.');
}

/*
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    Handlebars Helpers

    Handlebars helpers are custom functions that can be used within the templates 
    to perform specific tasks. They enhance the functionality of templates and 
    help simplify data manipulation directly within the view files.

    In this project, two helpers are provided:
    
    1. toLowerCase:
       - Converts a given string to lowercase.
       - Usage example: {{toLowerCase 'SAMPLE STRING'}} -> 'sample string'

    2. ifCond:
       - Compares two values for equality and returns a block of content based on 
         the comparison result.
       - Usage example: 
            {{#ifCond value1 value2}}
                <!-- Content if value1 equals value2 -->
            {{else}}
                <!-- Content if value1 does not equal value2 -->
            {{/ifCond}}
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/

// Set up Handlebars view engine with custom helpers
//
app.engine(
    'handlebars',
    expressHandlebars.engine({
        helpers: {
            toLowerCase: function (str) {
                return str.toLowerCase();
            },
            ifCond: function (v1, v2, options) {
                if (v1 === v2) {
                    return options.fn(this);
                }
                return options.inverse(this);
            },
        },
    })
);

app.set('view engine', 'handlebars');
app.set('views', './views');

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Middleware
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.use(
    session({
        secret: 'oneringtorulethemall',     // Secret key to sign the session ID cookie
        resave: false,                      // Don't save session if unmodified
        saveUninitialized: false,           // Don't create session until something stored
        cookie: { secure: false },          // True if using https. Set to false for development without https
    })
);

// Replace any of these variables below with constants for your application. These variables
// should be used in your template files. 
// 
app.use((req, res, next) => {
    res.locals.appName = 'Trailblogger';
    res.locals.copyrightYear = 2024;
    res.locals.postNeoType = 'Post';
    res.locals.loggedIn = req.session.loggedIn || false;
    res.locals.userId = req.session.userId || '';
    next();
});

app.use(express.static('public'));                  // Serve static files
app.use(express.urlencoded({ extended: true }));    // Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.json());                            // Parse JSON bodies (as sent by API clients)

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Routes
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Home route: render home view with posts and user
// We pass the posts and user variables into the home
// template
//
app.get('/', async (req, res) => {
    const posts = await getPosts();
    const user = await getCurrentUser(req) || {};
    res.render('home', { posts, user, apiKey: EMOJI_API_KEY });
});

// Register GET route is used for error response from registration
//
app.get('/register', (req, res) => {
    res.render('loginRegister', { regError: req.query.error });
});

// Login route GET route is used for error response from login
//
app.get('/login', (req, res) => {
    res.render('loginRegister', { loginError: req.query.error });
});

// Error route: render error page
//
app.get('/error', (req, res) => {
    res.render('error');
});

// Additional routes that you must implement

// Add a new post and redirect to home
app.post('/posts', async (req, res) => {
    const title = req.body.title;
    const content = req.body.content;
    const user = await getCurrentUser(req);
    if (user !== undefined) {
        await addPost(title, content, user);
        res.redirect('/');
    } else {
        res.redirect('/login');
    }
});
// Update post likes
app.post('/like/:id', isAuthenticated, async (req, res) => {
    await updatePostLikes(req, res);
});
// Render profile page
app.get('/profile', isAuthenticated, async (req, res) => {
    await renderProfile(req, res);
});
// Serve the avatar image for the user
app.get('/avatar/:username', async (req, res) => {
    await handleAvatar(req, res);
});
// Register a new user
app.post('/register', async (req, res) => {
    await registerUser(req, res);
});
// Login a user
app.post('/login', async (req, res) => {
    await loginUser(req, res);
});
// Logout the user
app.get('/logout', (req, res) => {
    logoutUser(req, res);
});
// Delete a post if the current user is the owner
app.post('/delete/:id', isAuthenticated, async (req, res) => {
    await deletePost(req, res);
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Server Activation
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Initialize the database and start the server
initializeDB().then(() => {
    console.log('Database initialized. Server starting...');
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize the database:', err);
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Support Functions and Variables
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Function to format the current date and time for timestamps
function getDate() {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hour}:${minute}`;
}

// Function to find a user by username
async function findUserByUsername(username) {
    return await db.get('SELECT * FROM users WHERE username = ?', [username]);
}

// Function to find a user by user ID
async function findUserById(userId) {
    return await db.get('SELECT * FROM users WHERE id = ?', [userId]);
}

// Function to find a post by post ID
async function findPostById(postId) {
    return await db.get('SELECT * FROM posts WHERE id = ?', [postId]);
}

// Function to add a new user into the database
async function addUser(username) {
    const date = getDate();
    const hashedGoogleId = '';  // REPLACE THIS LINE AFTER GOOGLE AUTH
    return await db.run('INSERT INTO users (username, hashedGoogleId, avatar_url, memberSince) VALUES (?, ?, ?, ?)', [username, hashedGoogleId, '', date]);
}

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    console.log(req.session.userId);
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Function to register a user
async function registerUser(req, res) {
    const username = req.body.username;
    const user = await findUserByUsername(username);

    if (user === undefined) {
        newUser = await addUser(username);
        req.session.userId = newUser.lastID
        req.session.username = username;
        req.session.loggedIn = true;
        res.redirect('/');
    } else {
        res.redirect('/register?error=InvalidCredentials');
    }

}

// Function to login a user
async function loginUser(req, res) {
    const username = req.body.username;
    const user = await findUserByUsername(username);
    if (user !== undefined) {
        req.session.username = username;
        req.session.userId = user.id;
        req.session.loggedIn = true;
        res.redirect('/');
    } else {
        res.redirect('/login?error=InvalidCredentials');
    }
}

// Function to logout a user
function logoutUser(req, res) {
    req.session.destroy();
    res.redirect('/');
}

// Function to render the profile page
async function renderProfile(req, res) {
    const user = await getCurrentUser(req);
    const userPosts = await db.all('SELECT * FROM posts WHERE username = ?', [user.username]);
    res.render('profile', { posts: userPosts, user });
}

// Function to update post likes
async function updatePostLikes(req, res) {
    const postId = parseInt(req.params.id);
    const post = await findPostById(postId);
    if (post !== undefined) {
        await db.run('UPDATE posts SET likes = likes + 1 WHERE id = ?', [postId]);
        res.status(200).json({ success: true, likes: post.likes });
    } else {
        res.status(404).json({ success: false, message: 'Post not found' });
    }
}

// Function to delete a post
async function deletePost(req, res) {
    const postId = parseInt(req.params.id);
    const post = await findPostById(postId);
    if (post !== undefined && post.username === req.session.username) {
        await db.run('DELETE FROM posts WHERE id = ?', [postId]);
        res.status(200).json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'Post not found or unauthorized' });
    }
}

// Function to handle avatar generation and serving
async function handleAvatar(req, res) {
    const username = req.params.username;
    const user = await findUserByUsername(username);
    if (user) {
        const avatar = await generateAvatar(username[0].toUpperCase());
        await db.run('UPDATE users SET avatar_url = ? WHERE username = ?', [avatar, username]);
        res.send(avatar);
    }
}

// Function to get the current user from session
async function getCurrentUser(req) {
    return await findUserById(req.session.userId);
}

// Function to get all posts, sorted by latest first
function getPosts() {
    return db.all('SELECT * FROM posts ORDER BY timestamp DESC');
}

// Function to add a new post
async function addPost(title, content, user) {
    const date = getDate();
    await db.run('INSERT INTO posts (title, content, username, timestamp, likes) VALUES (?, ?, ?, ?, ?)', [title, content, user.username, date, 0]);
}

// Function to generate an image avatar
async function generateAvatar(letter, width = 100, height = 100) {
    const colorSchemes = {
        A: '#d61111', B: '#d61167', C: '#d611bc', D: '#ab11d6', E: '#6d11d6', F: '#3c11d6', G: '#1142d6',
        H: '#118ad6', I: '#0ec7c1', J: '#0ec78c', K: '#0ec75b', L: '#4dad09', M: '#bfc900', N: '#cc8108', 
        O: '#cc4308', P: '#d61167', Q: '#ab11d6', R: '#3c11d6', S: '#118ad6', T: '#0ec78c', U: '#bfc900', 
        V: '#d61167', W: '#ab11d6', X: '#3c11d6', Y: '#118ad6', Z: '#0ec78c'
    };
    // 1. Choose a color scheme based on the letter
    let backgroundColor = colorSchemes[letter];
    // 2. Create a canvas with the specified width and height
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    // 3. Draw the background color
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, width, height);
    // 4. Draw the letter in the center
    context.fillStyle = '#FFFFFF';
    context.font = '50px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(letter, 50, 50);
    // 5. Return the avatar as a PNG buffer
    return canvas.toBuffer('image/png');
}