// populatedb.js

const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');

// Placeholder for the database file name
const dbFileName = 'microblog.db';

async function initializeDB() {
    const db = await sqlite.open({ filename: dbFileName, driver: sqlite3.Database });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            hashedGoogleId TEXT NOT NULL UNIQUE,
            avatar_url TEXT,
            memberSince DATETIME NOT NULL
        );

        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            username TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            likes INTEGER NOT NULL
        );
    `);

    // Sample data - Replace these arrays with your own data
    const users = [
        { id: 1, username: 'Caelus', hashedGoogleId: 'hashedGoogleId1', avatar_url: '', memberSince: '2023-04-26 12:00' },
        { id: 2, username: 'Stelle', hashedGoogleId: 'hashedGoogleId2', avatar_url: '', memberSince: '2023-04-26 12:00' },
        { id: 3, username: 'March 7th', hashedGoogleId: 'hashedGoogleId3', avatar_url: '', memberSince: '2023-04-26 12:00' },
        { id: 4, username: 'Dan Heng', hashedGoogleId: 'hashedGoogleId4', avatar_url: '', memberSince: '2023-04-26 12:00' },
        { id: 5, username: 'Welt', hashedGoogleId: 'hashedGoogleId5', avatar_url: '', memberSince: '2023-04-26 12:00' },
        { id: 6, username: 'Himeko', hashedGoogleId: 'hashedGoogleId6', avatar_url: '', memberSince: '2023-04-26 12:00' }
    ];

    const posts = [
        { id: 1, 
          title: 'Cute!', 
          content: 'Just took a bunch of new photos on our latest adventure! Can\'t wait to share them with everyone. #MemoryOfTheWorld #AstralExpress', 
          username: 'March 7th', 
          timestamp: '2024-04-07 10:00', 
          likes: 0 
        },
        { id: 2, 
          title: 'Morals of Penacony', 
          content: 'The balance of the universe can be delicate. Our latest mission has reminded me of the importance of maintaining harmony.', 
          username: 'Dan Heng', 
          timestamp: '2024-01-22 12:00', 
          likes: 0 
        },
        { id: 3, 
          title: 'That\'s that me, espresso~', 
          content: 'Enjoying a cup of coffee while plotting our next course. The stars never cease to amaze me. ', 
          username: 'Himeko', 
          timestamp: '2024-05-21 9:00', 
          likes: 0 
        }
    ];

    // Insert sample data into the database
    await Promise.all(users.map(user => {
        return db.run(
            'INSERT INTO users (username, hashedGoogleId, avatar_url, memberSince) VALUES (?, ?, ?, ?)',
            [user.username, user.hashedGoogleId, user.avatar_url, user.memberSince]
        );
    }));

    await Promise.all(posts.map(post => {
        return db.run(
            'INSERT INTO posts (title, content, username, timestamp, likes) VALUES (?, ?, ?, ?, ?)',
            [post.title, post.content, post.username, post.timestamp, post.likes]
        );
    }));

    console.log('Database populated with initial data.');
    await db.close();
}

initializeDB().catch(err => {
    console.error('Error initializing database:', err);
});