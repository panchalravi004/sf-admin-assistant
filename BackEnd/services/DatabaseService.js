'use strict';

/**
 * DatabaseService
 *
 * Singleton SQLite service using better-sqlite3.
 * Initialises the database file and creates all required tables on first run.
 *
 * Tables:
 *   users          – registered app users
 *   user_orgs      – Salesforce org connections per user
 *   chat_sessions  – conversation sessions per org
 *   chat_messages  – individual messages within a session
 *   action_logs    – every tool call made by the AI agent
 */

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');
const config   = require('../config');

class DatabaseService {
    constructor() {
        /** @type {import('better-sqlite3').Database} */
        this.db = null;
    }

    // ── Init ──────────────────────────────────────────────────────────────────

    init() {
        if (this.db) return this;

        // Ensure the data directory exists
        const dir = path.dirname(config.DB_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        this.db = new Database(config.DB_PATH);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');

        this._createTables();
        this._migrateTables();
        console.log(`[DatabaseService] SQLite initialised at ${config.DB_PATH}`);
        return this;
    }

    _createTables() {
        this.db.exec(`
            -- ── Users ──────────────────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS users (
                id            TEXT PRIMARY KEY,
                name          TEXT NOT NULL,
                email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                org_name      TEXT,
                created_at    TEXT NOT NULL DEFAULT (datetime('now'))
            );

            -- ── Salesforce org connections ──────────────────────────────────────
            CREATE TABLE IF NOT EXISTS user_orgs (
                id            TEXT PRIMARY KEY,
                user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name          TEXT NOT NULL,
                instance_url  TEXT NOT NULL,
                client_id     TEXT NOT NULL,
                client_secret TEXT NOT NULL,
                auth_type     TEXT NOT NULL DEFAULT 'clientCredentials',
                username      TEXT,
                password      TEXT,
                session_id    TEXT,
                access_token  TEXT,
                refresh_token TEXT,
                redirect_uri  TEXT,
                auth_code     TEXT,
                private_key   TEXT,
                audience      TEXT,
                login_url     TEXT,
                include_refresh_token INTEGER,
                environment   TEXT NOT NULL DEFAULT 'Sandbox',
                status        TEXT NOT NULL DEFAULT 'disconnected',
                sf_org_id     TEXT,
                connected_at  TEXT,
                created_at    TEXT NOT NULL DEFAULT (datetime('now'))
            );

            -- ── Chat sessions ───────────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id         TEXT PRIMARY KEY,
                user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                org_id     TEXT NOT NULL REFERENCES user_orgs(id) ON DELETE CASCADE,
                sf_org_id  TEXT,
                title      TEXT NOT NULL DEFAULT 'New Session',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            -- ── Chat messages ───────────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS chat_messages (
                id         TEXT PRIMARY KEY,
                session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
                role       TEXT NOT NULL CHECK(role IN ('user','assistant')),
                content    TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            -- ── Action / tool execution logs ────────────────────────────────────
            CREATE TABLE IF NOT EXISTS action_logs (
                id          TEXT PRIMARY KEY,
                session_id  TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
                tool_name   TEXT NOT NULL,
                params_json TEXT,
                status      TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','success','error')),
                result_json TEXT,
                error       TEXT,
                duration_ms INTEGER,
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );

            -- ── Indexes ────────────────────────────────────────────────────────
            CREATE INDEX IF NOT EXISTS idx_user_orgs_user       ON user_orgs(user_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_org         ON chat_sessions(org_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_sf_org      ON chat_sessions(sf_org_id);
            CREATE INDEX IF NOT EXISTS idx_messages_session     ON chat_messages(session_id);
            CREATE INDEX IF NOT EXISTS idx_action_logs_session  ON action_logs(session_id);
        `);
    }

    _migrateTables() {
        const userOrgColumns = this.db.prepare(`PRAGMA table_info(user_orgs)`).all();
        const hasColumn = (name) => userOrgColumns.some(col => col.name === name);

        if (!hasColumn('auth_type')) {
            this.db.exec(`
                ALTER TABLE user_orgs
                ADD COLUMN auth_type TEXT NOT NULL DEFAULT 'clientCredentials'
            `);
        }

        const authColumns = [
            { name: 'username', sqlType: 'TEXT' },
            { name: 'password', sqlType: 'TEXT' },
            { name: 'session_id', sqlType: 'TEXT' },
            { name: 'access_token', sqlType: 'TEXT' },
            { name: 'refresh_token', sqlType: 'TEXT' },
            { name: 'redirect_uri', sqlType: 'TEXT' },
            { name: 'auth_code', sqlType: 'TEXT' },
            { name: 'private_key', sqlType: 'TEXT' },
            { name: 'audience', sqlType: 'TEXT' },
            { name: 'login_url', sqlType: 'TEXT' },
            { name: 'include_refresh_token', sqlType: 'INTEGER' },
        ];

        for (const column of authColumns) {
            if (!hasColumn(column.name)) {
                this.db.exec(`
                    ALTER TABLE user_orgs
                    ADD COLUMN ${column.name} ${column.sqlType}
                `);
            }
        }
    }

    // ── Users ─────────────────────────────────────────────────────────────────

    createUser({ id, name, email, passwordHash, orgName }) {
        const stmt = this.db.prepare(`
            INSERT INTO users (id, name, email, password_hash, org_name)
            VALUES (@id, @name, @email, @passwordHash, @orgName)
        `);
        stmt.run({ id, name, email, passwordHash, orgName });
        return this.getUserById(id);
    }

    getUserByEmail(email) {
        return this.db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email);
    }

    getUserById(id) {
        return this.db.prepare(
            'SELECT id, name, email, org_name AS organization, created_at FROM users WHERE id = ?'
        ).get(id);
    }

    updateUser(id, { name, orgName }) {
        this.db.prepare(`
            UPDATE users SET
              name     = COALESCE(@name, name),
              org_name = COALESCE(@orgName, org_name)
            WHERE id = @id
        `).run({ id, name: name ?? null, orgName: orgName ?? null });
        return this.getUserById(id);
    }

    // ── Orgs ──────────────────────────────────────────────────────────────────

    _normalizeAuthFields(authFields = {}) {
        const toNullableText = (value) => {
            if (value === undefined || value === null) return null;
            const asString = String(value);
            return asString.length ? asString : null;
        };

        return {
            username: toNullableText(authFields.username),
            password: toNullableText(authFields.password),
            sessionId: toNullableText(authFields.sessionId),
            accessToken: toNullableText(authFields.accessToken),
            refreshToken: toNullableText(authFields.refreshToken),
            redirectUri: toNullableText(authFields.redirectUri),
            code: toNullableText(authFields.code),
            privateKey: toNullableText(authFields.privateKey),
            audience: toNullableText(authFields.audience),
            loginUrl: toNullableText(authFields.loginUrl),
            includeRefreshToken:
                authFields.includeRefreshToken === undefined || authFields.includeRefreshToken === null
                    ? null
                    : (authFields.includeRefreshToken ? 1 : 0),
        };
    }

    createOrg({ id, userId, name, instanceUrl, clientId, clientSecret, environment, authType, authFields }) {
        const normalizedAuthFields = this._normalizeAuthFields(authFields);

        this.db.prepare(`
            INSERT INTO user_orgs (
                id, user_id, name, instance_url, client_id, client_secret,
                auth_type, username, password, session_id, access_token, refresh_token,
                redirect_uri, auth_code, private_key, audience, login_url, include_refresh_token,
                environment
            )
            VALUES (
                @id, @userId, @name, @instanceUrl, @clientId, @clientSecret,
                @authType, @username, @password, @sessionId, @accessToken, @refreshToken,
                @redirectUri, @code, @privateKey, @audience, @loginUrl, @includeRefreshToken,
                @environment
            )
        `).run({
            id,
            userId,
            name,
            instanceUrl,
            clientId: clientId ?? '',
            clientSecret: clientSecret ?? '',
            authType: authType ?? 'clientCredentials',
            ...normalizedAuthFields,
            environment,
        });
        return this.getOrgById(id);
    }

    updateOrgConnection(id, {
        name,
        instanceUrl,
        clientId,
        clientSecret,
        environment,
        authType,
        authFields,
    }) {
        const normalizedAuthFields = this._normalizeAuthFields(authFields);

        this.db.prepare(`
            UPDATE user_orgs
            SET
                name = COALESCE(@name, name),
                instance_url = COALESCE(@instanceUrl, instance_url),
                client_id = COALESCE(@clientId, client_id),
                client_secret = COALESCE(@clientSecret, client_secret),
                environment = COALESCE(@environment, environment),
                auth_type = COALESCE(@authType, auth_type),
                username = @username,
                password = @password,
                session_id = @sessionId,
                access_token = @accessToken,
                refresh_token = @refreshToken,
                redirect_uri = @redirectUri,
                auth_code = @code,
                private_key = @privateKey,
                audience = @audience,
                login_url = @loginUrl,
                include_refresh_token = @includeRefreshToken
            WHERE id = @id
        `).run({
            id,
            name: name ?? null,
            instanceUrl: instanceUrl ?? null,
            clientId: clientId ?? null,
            clientSecret: clientSecret ?? null,
            environment: environment ?? null,
            authType: authType ?? null,
            ...normalizedAuthFields,
        });

        return this.getOrgById(id);
    }

    updateOrgAuthFields(id, authFields = {}) {
        const normalizedAuthFields = this._normalizeAuthFields(authFields);

        this.db.prepare(`
            UPDATE user_orgs
            SET
                username = @username,
                password = @password,
                session_id = @sessionId,
                access_token = @accessToken,
                refresh_token = @refreshToken,
                redirect_uri = @redirectUri,
                auth_code = @code,
                private_key = @privateKey,
                audience = @audience,
                login_url = @loginUrl,
                include_refresh_token = @includeRefreshToken
            WHERE id = @id
        `).run({ id, ...normalizedAuthFields });
    }

    getOrgById(id) {
        return this.db.prepare('SELECT * FROM user_orgs WHERE id = ?').get(id);
    }

    getOrgByUserAndInstance(userId, instanceUrl) {
        return this.db.prepare(
            'SELECT * FROM user_orgs WHERE user_id = ? AND instance_url = ?'
        ).get(userId, instanceUrl);
    }

    getOrgsByUser(userId) {
        return this.db.prepare(
            'SELECT * FROM user_orgs WHERE user_id = ? ORDER BY created_at DESC'
        ).all(userId);
    }

    /** Returns all orgs that were 'connected' at last save — used for server-start auto-reconnect. */
    getAllConnectedOrgs() {
        return this.db.prepare(
            `SELECT * FROM user_orgs WHERE status = 'connected' ORDER BY created_at ASC`
        ).all();
    }

    deleteOrg(id) {
        const result = this.db.prepare('DELETE FROM user_orgs WHERE id = ?').run(id);
        return result.changes > 0;
    }

    updateOrgStatus(id, { status, sfOrgId }) {
        this.db.prepare(`
            UPDATE user_orgs
            SET status = @status, sf_org_id = @sfOrgId,
                connected_at = CASE WHEN @status = 'connected' THEN datetime('now') ELSE connected_at END
            WHERE id = @id
        `).run({ id, status, sfOrgId: sfOrgId || null });
    }

    // ── Chat Sessions ─────────────────────────────────────────────────────────

    createSession({ id, userId, orgId, sfOrgId, title }) {
        this.db.prepare(`
            INSERT INTO chat_sessions (id, user_id, org_id, sf_org_id, title)
            VALUES (@id, @userId, @orgId, @sfOrgId, @title)
        `).run({ id, userId, orgId, sfOrgId: sfOrgId || null, title: title || 'New Session' });
        return this.getSessionById(id);
    }

    getSessionById(id) {
        return this.db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id);
    }

    getSessionsByOrg(orgId) {
        return this.db.prepare(
            'SELECT * FROM chat_sessions WHERE org_id = ? ORDER BY updated_at DESC'
        ).all(orgId);
    }

    getSessionsBySfOrg(sfOrgId, userId) {
        return this.db.prepare(
            'SELECT * FROM chat_sessions WHERE sf_org_id = ? AND user_id = ? ORDER BY updated_at DESC'
        ).all(sfOrgId, userId);
    }

    touchSession(id) {
        this.db.prepare(
            `UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?`
        ).run(id);
    }

    updateSessionTitle(id, title) {
        this.db.prepare('UPDATE chat_sessions SET title = ? WHERE id = ?').run(title, id);
    }

    deleteSession(id) {
        this.db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(id);
    }

    // ── Messages ──────────────────────────────────────────────────────────────

    addMessage({ id, sessionId, role, content }) {
        this.db.prepare(`
            INSERT INTO chat_messages (id, session_id, role, content)
            VALUES (@id, @sessionId, @role, @content)
        `).run({ id, sessionId, role, content });
    }

    getMessages(sessionId) {
        return this.db.prepare(
            'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC'
        ).all(sessionId);
    }

    getMessageCount(sessionId) {
        return this.db.prepare(
            'SELECT COUNT(*) as count FROM chat_messages WHERE session_id = ?'
        ).get(sessionId)?.count ?? 0;
    }

    // ── Action Logs ───────────────────────────────────────────────────────────

    createActionLog({ id, sessionId, toolName, paramsJson }) {
        this.db.prepare(`
            INSERT INTO action_logs (id, session_id, tool_name, params_json, status)
            VALUES (@id, @sessionId, @toolName, @paramsJson, 'pending')
        `).run({ id, sessionId, toolName, paramsJson: paramsJson || null });
        return id;
    }

    updateActionLog(id, { status, resultJson, error, durationMs }) {
        this.db.prepare(`
            UPDATE action_logs
            SET status = @status, result_json = @resultJson, error = @error, duration_ms = @durationMs
            WHERE id = @id
        `).run({ id, status, resultJson: resultJson || null, error: error || null, durationMs: durationMs || null });
    }

    getActionLogs(sessionId) {
        return this.db.prepare(
            'SELECT * FROM action_logs WHERE session_id = ? ORDER BY created_at ASC'
        ).all(sessionId);
    }

    getAllActionLogsByUser(userId) {
        return this.db.prepare(`
            SELECT al.*, cs.title AS session_title, uo.name AS org_name
            FROM action_logs al
            JOIN chat_sessions cs ON al.session_id = cs.id
            JOIN user_orgs uo ON cs.org_id = uo.id
            WHERE cs.user_id = ?
            ORDER BY al.created_at DESC
        `).all(userId);
    }
}

// Singleton
const dbService = new DatabaseService();
module.exports = dbService;
