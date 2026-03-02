'use strict';

const jwt    = require('jsonwebtoken');
const config = require('../config');

/**
 * requireAuth
 * Verifies Bearer JWT from the Authorization header.
 * Attaches req.user = { id, email } on success.
 */
const requireAuth = (req, res, next) => {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = header.slice(7);
    try {
        const payload = jwt.verify(token, config.JWT_SECRET);
        req.user = { id: payload.id, email: payload.email };
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
};

module.exports = { requireAuth };
