'use strict';

const express = require('express');
const { handleSignup, handleLogin, handleProfile, handleUpdateProfile } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/signup',   handleSignup);
router.post('/login',    handleLogin);
router.get('/profile',   requireAuth, handleProfile);
router.patch('/profile', requireAuth, handleUpdateProfile);

module.exports = router;
