require('dotenv').config();

const path = require('path');

module.exports = {
	// Server Configuration
	PORT: process.env.PORT || 4000,
	NODE_ENV: process.env.NODE_ENV || 'development',

	CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',

	OPENAI_API_KEY: process.env.OPENAI_API_KEY,

	// JWT
	JWT_SECRET: process.env.JWT_SECRET || 'sf-admin-secret-change-in-prod',
	JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

	// SQLite
	DB_PATH: process.env.DB_PATH || path.join(__dirname, 'data', 'sf_admin.db'),
}