// website/server.js - Express server for ticket management website
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true in production with HTTPS
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL || "http://localhost:3000/auth/discord/callback",
    scope: ['identify', 'guilds']
}, async(accessToken, refreshToken, profile, done) => {
    // Store user data
    const userData = {
        id: profile.id,
        username: profile.username,
        discriminator: profile.discriminator,
        avatar: profile.avatar,
        guilds: profile.guilds || [],
        accessToken: accessToken
    };
    return done(null, userData);
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/auth/discord');
};

const requireStaff = async(req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/auth/discord');
    }

    // Check if user is staff (this would connect to your bot's config)
    // For now, we'll assume all authenticated users can access
    next();
};

// Routes
app.get('/', (req, res) => {
    res.render('index', {
        user: req.user,
        title: 'Ticket System Dashboard'
    });
});

// Authentication routes
app.get('/auth/discord', passport.authenticate('discord'));
app.get('/auth/discord/callback',
    passport.authenticate('discord', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/dashboard');
    }
);

app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) console.error(err);
        res.redirect('/');
    });
});

// Dashboard routes
app.get('/dashboard', requireAuth, (req, res) => {
    // Load ticket statistics
    const stats = {
        total: 150,
        open: 12,
        closed: 138,
        claimed: 45
    };

    res.render('dashboard', {
        user: req.user,
        title: 'Dashboard - Ticket System',
        stats: stats
    });
});

app.get('/tickets', requireAuth, (req, res) => {
    // Load tickets data (would come from database)
    const tickets = [{
            id: '#123456',
            user: { username: 'TestUser', discriminator: '1234' },
            status: 'open',
            createdAt: new Date(),
            claimedBy: null
        },
        {
            id: '#123457',
            user: { username: 'AnotherUser', discriminator: '5678' },
            status: 'closed',
            createdAt: new Date(Date.now() - 86400000),
            claimedBy: { username: 'Staff', discriminator: '0001' }
        }
    ];

    res.render('tickets', {
        user: req.user,
        title: 'Tickets Management',
        tickets: tickets
    });
});

app.get('/profile', requireAuth, (req, res) => {
    res.render('profile', {
        user: req.user,
        title: 'User Profile'
    });
});

// Transcript routes
app.get('/transcript/:id', (req, res) => {
    const transcriptId = req.params.id;
    const transcriptPath = path.join(__dirname, '../transcripts', `${transcriptId}.json`);

    if (!fs.existsSync(transcriptPath)) {
        return res.status(404).render('404', {
            title: 'Transcript Not Found',
            user: req.user
        });
    }

    try {
        const transcriptData = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
        res.render('transcript', {
            title: `Transcript - ${transcriptData.channelName}`,
            transcript: transcriptData,
            user: req.user
        });
    } catch (error) {
        console.error('Error loading transcript:', error);
        res.status(500).render('error', {
            title: 'Error Loading Transcript',
            error: 'Could not load transcript data',
            user: req.user
        });
    }
});

// API Routes
app.get('/api/stats', requireAuth, (req, res) => {
    const stats = {
        total: 150,
        open: 12,
        closed: 138,
        claimed: 45,
        today: 8,
        thisWeek: 32,
        thisMonth: 120
    };
    res.json(stats);
});

app.get('/api/tickets', requireAuth, (req, res) => {
    // This would fetch from database
    const tickets = [{
        id: '#123456',
        user: { username: 'TestUser', discriminator: '1234', id: '123456789' },
        status: 'open',
        createdAt: new Date().toISOString(),
        claimedBy: null,
        priority: 'normal'
    }];
    res.json(tickets);
});

app.post('/api/tickets/:id/close', requireStaff, (req, res) => {
    const ticketId = req.params.id;
    // Logic to close ticket
    res.json({ success: true, message: 'Ticket closed successfully' });
});

app.post('/api/tickets/:id/claim', requireStaff, (req, res) => {
    const ticketId = req.params.id;
    // Logic to claim ticket
    res.json({ success: true, message: 'Ticket claimed successfully' });
});

// Error handlers
app.use((req, res) => {
    res.status(404).render('404', {
        title: 'Page Not Found',
        user: req.user
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', {
        title: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!',
        user: req.user
    });
});

app.listen(PORT, () => {
    console.log(`🌐 Website server running on port ${PORT}`);
    console.log(`🔗 Visit: http://localhost:${PORT}`);
});