'use strict';

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const db     = require('../services/DatabaseService');
const config = require('../config');

// ── helpers ────────────────────────────────────────────────────────────────

const signToken = (user) =>
    jwt.sign({ id: user.id, email: user.email }, config.JWT_SECRET, {
        expiresIn: config.JWT_EXPIRES_IN,
    });

// ── POST /api/v1/user/signup ───────────────────────────────────────────────

const handleSignup = async (req, res) => {
    try {
        const { name, email, password, orgName } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'name, email, and password are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        const existing = db.getUserByEmail(email);
        if (existing) {
            return res.status(409).json({ success: false, message: 'Email is already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const user = db.createUser({
            id: uuidv4(),
            name,
            email,
            passwordHash,
            orgName: orgName || null,
        });

        const token = signToken(user);

        return res.status(201).json({
            success: true,
            message: 'Account created successfully',
            data: { user, token },
        });
    } catch (error) {
        console.error('[handleSignup]', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ── POST /api/v1/user/login ────────────────────────────────────────────────

const handleLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'email and password are required' });
        }

        const row = db.getUserByEmail(email);
        if (!row) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        const match = await bcrypt.compare(password, row.password_hash);
        if (!match) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        const user = { id: row.id, name: row.name, email: row.email, organization: row.org_name };
        const token = signToken(user);

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: { user, token },
        });
    } catch (error) {
        console.error('[handleLogin]', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ── GET /api/v1/user/profile ───────────────────────────────────────────────

const handleProfile = (req, res) => {
    try {
        const user = db.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        return res.status(200).json({ success: true, data: user });
    } catch (error) {
        console.error('[handleProfile]', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ── PATCH /api/v1/user/profile ────────────────────────────────────────────

const handleUpdateProfile = async (req, res) => {
    try {
        const { name, organization } = req.body;
        if (!name && !organization) {
            return res.status(400).json({ success: false, message: 'Nothing to update' });
        }
        const updated = db.updateUser(req.user.id, { name, orgName: organization });
        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        console.error('[handleUpdateProfile]', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { handleSignup, handleLogin, handleProfile, handleUpdateProfile };
