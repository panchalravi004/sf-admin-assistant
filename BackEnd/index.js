const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const { createServer } = require('http');
const { Server } = require('socket.io');

const config          = require('./config');
const db              = require('./services/DatabaseService');
const { requireAuth } = require('./middleware/auth');
const userRouter      = require('./routes/user');
const salesforceRouter = require('./routes/salesforce');
const { initializeConnections } = require('./controllers/salesforceController');

// Initialise SQLite (creates tables on first run)
db.init();

const app    = express();
const server = createServer(app);
const io     = new Server(server, {
    cors: { origin: config.CLIENT_URL, methods: ['GET', 'POST'] }
});

app.use(helmet());
app.use(cors({
    origin: config.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(cookieParser());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'SF Admin Assistant API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});

// Public routes
app.use('/api/v1/user', userRouter);

// Protected routes
app.use('/api/v1/sf', requireAuth, salesforceRouter);

// 404 fallback
app.use('*', (_req, res) => {
    res.status(404).json({ status: 'Error', message: 'Route not found' });
});

// Socket.IO
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join_session', (sessionId) => {
        socket.join(`session:${sessionId}`);
        console.log(`Socket ${socket.id} joined session:${sessionId}`);
    });

    socket.on('leave_session', (sessionId) => {
        socket.leave(`session:${sessionId}`);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Expose io globally so controllers can emit events
global.io = io;

const PORT = config.PORT || 3000;
server.listen(PORT, () => {
    console.log(`SF Admin Assistant API running on port ${PORT}`);
    // Reconnect all orgs that were connected at last shutdown
    initializeConnections().catch(err =>
        console.error('[initializeConnections] Unexpected error:', err.message)
    );
});

process.on('SIGTERM', () => {
    server.close(() => console.log('Process terminated'));
});
