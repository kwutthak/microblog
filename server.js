const express = require('express');
const expressHandlebars = require('express-handlebars');
const session = require('express-session');
const canvas = require('canvas');
const { createCanvas } = require('canvas');
const { register } = require('module');

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Configuration and Setup
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const app = express();
const PORT = 3000;

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
    res.locals.appName = 'MicroBlog';
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
app.get('/', (req, res) => {
    const posts = getPosts();
    const user = getCurrentUser(req) || {};
    res.render('home', { posts, user });
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
app.post('/posts', (req, res) => {
    const title = req.body.title;
    const content = req.body.content;
    const user = getCurrentUser(req);
    addPost(title, content, user);
    res.redirect('/');
});
// Update post likes
app.post('/like/:id', isAuthenticated, (req, res) => {
    updatePostLikes(req, res);
});
// Render profile page
app.get('/profile', isAuthenticated, (req, res) => {
    renderProfile(req, res);
});
// Serve the avatar image for the user
app.get('/avatar/:username', (req, res) => {
    handleAvatar(req, res);
});
// Register a new user
app.post('/register', (req, res) => {
    registerUser(req, res);
});
// Login a user
app.post('/login', (req, res) => {
    loginUser(req, res);
});
// Logout the user
app.get('/logout', (req, res) => {
    logoutUser(req, res);
});
// Delete a post if the current user is the owner
app.post('/delete/:id', isAuthenticated, (req, res) => {
    deletePost(req, res);
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Server Activation
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Support Functions and Variables
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Example data for posts and users

let nextId = 2;

let posts = [
    { id: 1, title: 'Sample Post', content: 'This is a sample post.', username: 'SampleUser', timestamp: '2024-01-01 10:00', likes: 0 },
    { id: 2, title: 'Another Post', content: 'This is another sample post.', username: 'AnotherUser', timestamp: '2024-01-02 12:00', likes: 0 },
];
let users = [
    { id: 1, username: 'SampleUser', avatar_url: undefined, memberSince: '2024-01-01 08:00' },
    { id: 2, username: 'AnotherUser', avatar_url: undefined, memberSince: '2024-01-02 09:00' },
];

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
function findUserByUsername(username) {
    for (let user of users) {
        if (user.username === username) {
            return user;
        }
    }
    return undefined;
}

// Function to find a user by user ID
function findUserById(userId) {
    for (let user of users) {
        if (user.id === userId) {
            return user;
        }
    }
    return undefined;
}

// Function to find a post by post ID
function findPostById(postId) {
    for (let post of posts) {
        if (post.id === postId) {
            return post;
        }
    }
    return undefined;
}

// Function to add a new user
function addUser(username) {
    const newUser = { id: users.length + 1, username, avatar_url: undefined, memberSince: getDate() };
    users.push(newUser);
    return newUser;
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
function registerUser(req, res) {
    const username = req.body.username;
    const user = findUserByUsername(username);
    if (user === undefined) {
        req.session.userId = addUser(username).id;
        req.session.username = username;
        req.session.loggedIn = true;
        res.redirect('/');
    } else {
        res.redirect('/register?error=InvalidCredentials');
    }
}

// Function to login a user
function loginUser(req, res) {
    const username = req.body.username;
    const user = findUserByUsername(username);
    if (user !== undefined) {
        req.session.username = username;
        req.session.userId = findUserByUsername(username).id;
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
function renderProfile(req, res) {
    const user = getCurrentUser(req);
    const userPosts = posts.filter(post => post.username === user.username);
    res.render('profile', { posts: userPosts, user });
}

// Function to update post likes
function updatePostLikes(req, res) {
    const postId = parseInt(req.params.id);
    const post = findPostById(postId);
    if (post !== undefined) {
        post.likes += 1;
        res.status(200).json({ success: true, likes: post.likes });
    } else {
        res.status(404).json({ success: false, message: 'Post not found' });
    }
}

// Function to delete a post
function deletePost(req, res) {
    const postId = parseInt(req.params.id);
    const post = findPostById(postId);
    if (post !== undefined && post.username === req.session.username) {
        posts = posts.filter(post => post.id !== postId);
        res.status(200).json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'Post not found or unauthorized' });
    }
}

// Function to handle avatar generation and serving
function handleAvatar(req, res) {
    const username = req.params.username;
    const user = findUserByUsername(username);
    if (user.avatar_url === undefined) {
        const avatar = generateAvatar(username[0]);
        user.avatar_url = avatar;
    }
    res.send(Buffer.from(user.avatar_url.split(',')[1], 'base64'));
}

// Function to get the current user from session
function getCurrentUser(req) {
    return findUserById(req.session.userId);
}

// Function to get all posts, sorted by latest first
function getPosts() {
    return posts.slice().reverse();
}

// Function to add a new post
function addPost(title, content, user) {
    nextId++;
    const newPost = { id: nextId, title, content, username: user.username, timestamp: getDate(), likes: 0 };
    posts.push(newPost);
}

// Function to generate an image avatar
function generateAvatar(letter, width = 100, height = 100) {
    const numColors = 16777215; // #000000 to #FFFFFF
    // 1. Choose a color scheme based on the letter
    let randColor = "#" + Math.floor(Math.random() * numColors).toString(16).padStart(6, '0');;
    // 2. Create a canvas with the specified width and height
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    // 3. Draw the background color
    context.fillStyle = randColor;
    context.fillRect(0, 0, width, height);
    // 4. Draw the letter in the center
    context.fillStyle = '#FFFFFF';
    context.font = '50px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(letter, 50, 50);
    // 5. Return the avatar as a PNG buffer
    const buffer = canvas.toDataURL('image/png');
    return buffer;
}