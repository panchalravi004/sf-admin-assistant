'use strict';

const { v4: uuidv4 } = require('uuid');
const { SalesforceMetadataService, AUTH_TYPES } = require('../services/SalesforceMetadataService');
const SalesforceConversationService = require('../services/SalesforceConversationService');
const db = require('../services/DatabaseService');

// ── In-memory maps (SF connection state is not persisted) ──────────────────
/** sfOrgId → SalesforceMetadataService */
const connectionMap = new Map();
/** One shared conversation service manages all LangChain sessions */
const conversationService = new SalesforceConversationService();

const AUTH_VALUES = [
    AUTH_TYPES.CLIENT_CREDENTIALS,
    AUTH_TYPES.SESSION_ID,
    AUTH_TYPES.USERNAME_PASSWORD,
];

const AUTH_REQUIRED_FIELDS = {
    [AUTH_TYPES.USERNAME_PASSWORD]: ['username', 'password'],
    [AUTH_TYPES.SESSION_ID]: ['sessionId', 'instanceUrl'],
    [AUTH_TYPES.CLIENT_CREDENTIALS]: ['clientId', 'clientSecret', 'instanceUrl'],
};

const defaultLoginUrlForEnvironment = (environment) =>
    environment === 'Production' ? 'https://login.salesforce.com' : 'https://test.salesforce.com';

const SENSITIVE_ORG_FIELDS = [
    'client_id',
    'client_secret',
    'username',
    'password',
    'session_id',
    'access_token',
    'refresh_token',
    'redirect_uri',
    'auth_code',
    'private_key',
    'audience',
    'login_url',
    'include_refresh_token',
    'auth_config_json',
];

const hasValue = (value) => {
    if (typeof value === 'string') return value.trim().length > 0;
    return value !== undefined && value !== null;
};

const normalizeAuthType = (rawType) => rawType || AUTH_TYPES.CLIENT_CREDENTIALS;

const getRequiredFieldsForAuthType = (authType) => AUTH_REQUIRED_FIELDS[authType] || [];

const pickRequiredAuthFields = (authType, source = {}) => {
    const required = getRequiredFieldsForAuthType(authType);
    const picked = {};

    for (const key of required) {
        if (hasValue(source[key])) {
            picked[key] = source[key];
        }
    }

    return picked;
};

const normalizeAuthConfig = (body = {}, authType) => {
    const config = (typeof body.authConfig === 'object' && body.authConfig !== null)
        ? { ...body.authConfig }
        : {};

    const requiredKeys = getRequiredFieldsForAuthType(authType);

    for (const key of requiredKeys) {
        if (!hasValue(config[key]) && hasValue(body[key])) {
            config[key] = body[key];
        }
    }

    return pickRequiredAuthFields(authType, config);
};

const getMissingAuthFields = (authType, authConfig) => {
    const required = getRequiredFieldsForAuthType(authType);
    return required.filter((field) => !hasValue(authConfig[field]));
};

const parseLegacyAuthConfigJson = (rawConfig) => {
    if (!rawConfig) return {};
    if (typeof rawConfig === 'object') return { ...rawConfig };

    try {
        const parsed = JSON.parse(rawConfig);
        return (typeof parsed === 'object' && parsed !== null) ? parsed : {};
    } catch {
        return {};
    }
};

const buildAuthConfigFromOrgColumns = (org) => {
    const config = {
        instanceUrl: hasValue(org.instance_url) ? org.instance_url : undefined,
        clientId: hasValue(org.client_id) ? org.client_id : undefined,
        clientSecret: hasValue(org.client_secret) ? org.client_secret : undefined,
        username: hasValue(org.username) ? org.username : undefined,
        password: hasValue(org.password) ? org.password : undefined,
        sessionId: hasValue(org.session_id) ? org.session_id : undefined,
        accessToken: hasValue(org.access_token) ? org.access_token : undefined,
        refreshToken: hasValue(org.refresh_token) ? org.refresh_token : undefined,
        redirectUri: hasValue(org.redirect_uri) ? org.redirect_uri : undefined,
        code: hasValue(org.auth_code) ? org.auth_code : undefined,
        privateKey: hasValue(org.private_key) ? org.private_key : undefined,
        audience: hasValue(org.audience) ? org.audience : undefined,
        loginUrl: hasValue(org.login_url) ? org.login_url : undefined,
    };

    if (org.include_refresh_token !== undefined && org.include_refresh_token !== null) {
        config.includeRefreshToken = Boolean(org.include_refresh_token);
    }

    return config;
};

const buildDbAuthFields = (authConfig = {}) => ({
    username: hasValue(authConfig.username) ? authConfig.username : null,
    password: hasValue(authConfig.password) ? authConfig.password : null,
    sessionId: hasValue(authConfig.sessionId) ? authConfig.sessionId : null,
    accessToken: hasValue(authConfig.accessToken) ? authConfig.accessToken : null,
    refreshToken: hasValue(authConfig.refreshToken) ? authConfig.refreshToken : null,
    redirectUri: hasValue(authConfig.redirectUri) ? authConfig.redirectUri : null,
    code: hasValue(authConfig.code) ? authConfig.code : null,
    privateKey: hasValue(authConfig.privateKey) ? authConfig.privateKey : null,
    audience: hasValue(authConfig.audience) ? authConfig.audience : null,
    loginUrl: hasValue(authConfig.loginUrl) ? authConfig.loginUrl : null,
    includeRefreshToken:
        authConfig.includeRefreshToken === undefined || authConfig.includeRefreshToken === null
            ? null
            : (authConfig.includeRefreshToken ? 1 : 0),
});

const buildReconnectAuthInput = (org) => {
    const storedAuthType = normalizeAuthType(org.auth_type);
    if (!AUTH_VALUES.includes(storedAuthType)) {
        throw new Error(`Auth flow ${storedAuthType} is not supported.`);
    }

    const legacyConfig = parseLegacyAuthConfigJson(org.auth_config_json);
    const columnConfig = buildAuthConfigFromOrgColumns(org);

    const mergedConfig = {
        ...legacyConfig,
        ...columnConfig,
        instanceUrl: columnConfig.instanceUrl || legacyConfig.instanceUrl || org.instance_url,
        clientId: columnConfig.clientId || legacyConfig.clientId || org.client_id || undefined,
        clientSecret: columnConfig.clientSecret || legacyConfig.clientSecret || org.client_secret || undefined,
    };

    const reconnectType = storedAuthType;

    const reconnectConfig = pickRequiredAuthFields(reconnectType, mergedConfig);

    const missing = getMissingAuthFields(reconnectType, reconnectConfig);
    if (missing.length) {
        throw new Error(`Missing saved auth fields: ${missing.join(', ')}`);
    }

    return { storedAuthType, reconnectType, reconnectConfig };
};

const buildPersistableAuthConfig = (authType, authConfig, svc) => {
    const persisted = { ...authConfig };
    const conn = svc.getConnection();

    delete persisted.code;
    delete persisted.onRefresh;

    if (conn.instanceUrl) {
        persisted.instanceUrl = conn.instanceUrl;
    }

    if (
        authType === AUTH_TYPES.ACCESS_TOKEN_WITH_REFRESH ||
        authType === AUTH_TYPES.AUTHORIZATION_CODE
    ) {
        if (conn.accessToken) persisted.accessToken = conn.accessToken;
        if (conn.refreshToken) persisted.refreshToken = conn.refreshToken;
    }

    return persisted;
};

const resolveSfOrgId = async (svc, userInfo) => {
    const connUserInfo = svc.getConnection()?.userInfo || {};
    const fromAuth =
        userInfo?.organizationId ||
        userInfo?.organization_id ||
        connUserInfo.organizationId ||
        connUserInfo.organization_id;

    if (fromAuth) return fromAuth;

    try {
        const identity = await svc.getIdentity();
        const identityOrgId = identity?.organization_id || identity?.organizationId;
        if (identityOrgId) return identityOrgId;
    } catch {
        // Ignore and try SOQL fallback.
    }

    try {
        const result = await svc.queryRecords('SELECT Id FROM Organization LIMIT 1', { maxRecords: 1 });
        const orgId = result?.records?.[0]?.Id;
        if (orgId) return orgId;
    } catch {
        // Ignore and throw below.
    }

    throw new Error('Connected successfully, but failed to resolve Salesforce org id.');
};

const toSafeOrg = (org) => {
    const safeOrg = { ...org };
    for (const field of SENSITIVE_ORG_FIELDS) {
        delete safeOrg[field];
    }

    return {
        ...safeOrg,
        isLive: connectionMap.has(safeOrg.sf_org_id),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /connect  –  Connect a Salesforce org
// ─────────────────────────────────────────────────────────────────────────────

const handleORGConnection = async (req, res) => {
    try {
        const userId = req.user.id;
        const environment = req.body.environment || 'Sandbox';
        const authType = normalizeAuthType(req.body.authType);

        if (!AUTH_VALUES.includes(authType)) {
            return res.status(400).json({
                success: false,
                message: `Invalid authType. Supported values: ${AUTH_VALUES.join(', ')}`,
            });
        }

        const authConfig = normalizeAuthConfig(req.body, authType);
        const missingFields = getMissingAuthFields(authType, authConfig);

        if (missingFields.length) {
            return res.status(400).json({
                success: false,
                message: `Missing required auth fields for ${authType}: ${missingFields.join(', ')}`,
            });
        }

        const svc = new SalesforceMetadataService({
            apiVersion: '60.0',
            loginUrl: defaultLoginUrlForEnvironment(environment),
        });

        const { userInfo } = await svc.connect({
            type: authType,
            ...authConfig,
        });

        const sfOrgId = await resolveSfOrgId(svc, userInfo);
        const persistedAuthConfig = buildPersistableAuthConfig(authType, authConfig, svc);
        const dbAuthFields = buildDbAuthFields(persistedAuthConfig);
        const resolvedInstanceUrl = persistedAuthConfig.instanceUrl || authConfig.instanceUrl;

        if (!hasValue(resolvedInstanceUrl)) {
            return res.status(400).json({
                success: false,
                message: 'Connected, but no instanceUrl was resolved. Please include instanceUrl in authConfig.',
            });
        }

        const instanceUrl = String(resolvedInstanceUrl).trim();
        const orgName = req.body.name || userInfo?.organizationName || instanceUrl;

        // Persist or update org record
        let orgRecord = db.getOrgByUserAndInstance(userId, instanceUrl);
        if (!orgRecord) {
            orgRecord = db.createOrg({
                id:           uuidv4(),
                userId,
                name:         orgName,
                instanceUrl,
                clientId:     persistedAuthConfig.clientId || '',
                clientSecret: persistedAuthConfig.clientSecret || '',
                environment,
                authType,
                authFields: dbAuthFields,
            });
        } else {
            if (orgRecord.sf_org_id && orgRecord.sf_org_id !== sfOrgId) {
                connectionMap.delete(orgRecord.sf_org_id);
            }

            orgRecord = db.updateOrgConnection(orgRecord.id, {
                name:         orgName,
                instanceUrl,
                clientId:     persistedAuthConfig.clientId || orgRecord.client_id || '',
                clientSecret: persistedAuthConfig.clientSecret || orgRecord.client_secret || '',
                environment,
                authType,
                authFields: dbAuthFields,
            });
        }

        db.updateOrgStatus(orgRecord.id, { status: 'connected', sfOrgId });
        orgRecord = db.getOrgById(orgRecord.id);

        // Keep live connection in memory
        connectionMap.set(sfOrgId, svc);

        return res.status(200).json({
            success: true,
            message: 'Connected to Salesforce successfully',
            data: {
                org:    toSafeOrg(orgRecord),
                sfInfo:  userInfo,
            },
        });

    } catch (error) {
        console.error('[handleORGConnection]', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to connect: ' + error.message,
            stack:   process.env.NODE_ENV === 'development' ? error.stack : undefined,
        });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /orgs  –  List all orgs for the authenticated user
// ─────────────────────────────────────────────────────────────────────────────

const handleGetOrgs = (req, res) => {
    try {
        const orgs = db.getOrgsByUser(req.user.id).map(toSafeOrg);
        return res.status(200).json({ success: true, data: orgs });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /get/resources  –  Direct metadata read (legacy)
// ─────────────────────────────────────────────────────────────────────────────

const handleGetResources = async (req, res) => {
    try {
        const { sfOrgId, resourceType, resourceNames } = req.query;

        if (!connectionMap.has(sfOrgId)) {
            return res.status(404).json({
                success: false,
                message: 'No live connection for this org. Please re-connect.',
            });
        }

        const svc      = connectionMap.get(sfOrgId);
        const metadata = await svc.readMetadata(resourceType, resourceNames.split(','));

        return res.status(200).json({
            success: true,
            message: 'Retrieved metadata successfully',
            data:    metadata,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error retrieving resources: ' + error.message,
            stack:   process.env.NODE_ENV === 'development' ? error.message + '\n' + error.stack : undefined,
        });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /conversation  –  Send a message in a chat session
// ─────────────────────────────────────────────────────────────────────────────

const handleConversation = async (req, res) => {
    try {
        const { sfOrgId, sessionId, input_text } = req.body;
        const userId = req.user.id;

        if (!sfOrgId || !input_text) {
            return res.status(400).json({
                success: false,
                message: 'sfOrgId and input_text are required',
            });
        }

        if (!connectionMap.has(sfOrgId)) {
            return res.status(404).json({
                success: false,
                message: 'No live connection for this org. Please re-connect first.',
            });
        }

        const sfSvc    = connectionMap.get(sfOrgId);

        // Resolve or create the DB chat session
        let dbSession;
        if (sessionId) {
            dbSession = db.getSessionById(sessionId);
        }

        if (!dbSession) {
            // Look up the org DB record
            const orgs = db.getOrgsByUser(userId).filter(o => o.sf_org_id === sfOrgId);
            if (!orgs.length) {
                return res.status(404).json({ success: false, message: 'Org not found in your account.' });
            }
            const orgRecord = orgs[0];

            dbSession = db.createSession({
                id:      uuidv4(),
                userId,
                orgId:   orgRecord.id,
                sfOrgId,
                title:   input_text.slice(0, 60),
            });
        }

        const sid = dbSession.id;

        // Action log callback — persists every tool invocation to the DB
        const onActionLog = async ({ id, toolName, params, status, result, error, duration }) => {
            if (status === 'pending') {
                db.createActionLog({
                    id,
                    sessionId: sid,
                    toolName,
                    paramsJson: JSON.stringify(params),
                });
            } else {
                db.updateActionLog(id, {
                    status,
                    resultJson: result   ? JSON.stringify(result)   : null,
                    error:      error    || null,
                    durationMs: duration || null,
                });
            }
            // Emit via Socket.IO for every status change — use snake_case to match DB field names
            if (global.io) {
                global.io.to(`session:${sid}`).emit('action_log', {
                    id,
                    tool_name:   toolName,
                    params_json: params  ? JSON.stringify(params)  : null,
                    result_json: result  ? JSON.stringify(result)  : null,
                    status,
                    error:       error   || null,
                    duration_ms: duration || null,
                    created_at:  new Date().toISOString(),
                    session_id:  sid,
                });
            }
        };

        // Run the AI turn
        const aiResult = await conversationService.chat({
            orgId:      sfOrgId,
            sessionId:  sid,
            inputText:  input_text,
            sfSvc,
            onActionLog,
        });

        // Persist both messages to DB
        db.addMessage({ id: uuidv4(), sessionId: sid, role: 'user',      content: input_text });
        db.addMessage({ id: uuidv4(), sessionId: sid, role: 'assistant', content: aiResult.response });
        db.touchSession(sid);

        // Auto-generate a better title from first message
        const msgCount = db.getMessageCount(sid);
        if (msgCount <= 2) {
            db.updateSessionTitle(sid, input_text.slice(0, 60));
        }

        return res.status(200).json({
            success: true,
            message: 'Response generated successfully',
            data: {
                response:  aiResult.response,
                sessionId: sid,
                usage:     aiResult.usage,
                turns:     aiResult.turns,
            },
        });

    } catch (error) {
        console.error('[handleConversation]', error);
        return res.status(500).json({
            success: false,
            message: 'Error in conversation: ' + error.message,
            stack:   process.env.NODE_ENV === 'development' ? error.stack : undefined,
        });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /sessions/:orgId  –  List sessions for an org
// ─────────────────────────────────────────────────────────────────────────────

const handleGetSessions = (req, res) => {
    try {
        const { orgId } = req.params;
        const sessions  = db.getSessionsByOrg(orgId).map(s => ({
            ...s,
            messageCount: db.getMessageCount(s.id),
        }));
        return res.status(200).json({ success: true, data: sessions });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// GET /sessions/sf/:sfOrgId  –  List sessions by Salesforce org ID
const handleGetSessionsBySfOrg = (req, res) => {
    try {
        const { sfOrgId } = req.params;
        const sessions = db.getSessionsBySfOrg(sfOrgId, req.user.id).map(s => ({
            ...s,
            messageCount: db.getMessageCount(s.id),
        }));
        return res.status(200).json({ success: true, data: sessions });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /messages/:sessionId  –  Load messages for a session
// ─────────────────────────────────────────────────────────────────────────────

const handleGetMessages = (req, res) => {
    try {
        const messages = db.getMessages(req.params.sessionId);
        return res.status(200).json({ success: true, data: messages });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /sessions/:sessionId  –  Delete a session
// ─────────────────────────────────────────────────────────────────────────────

const handleDeleteSession = (req, res) => {
    try {
        const { sessionId } = req.params;
        db.deleteSession(sessionId);
        conversationService.deleteSession(sessionId);
        return res.status(200).json({ success: true, message: 'Session deleted' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /logs/:sessionId  –  Action logs for a session
// ─────────────────────────────────────────────────────────────────────────────

const handleGetActionLogs = (req, res) => {
    try {
        const logs = db.getActionLogs(req.params.sessionId);
        return res.status(200).json({ success: true, data: logs });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// GET /logs  –  All action logs for the current user (Logs page)
const handleGetAllActionLogs = (req, res) => {
    try {
        const logs = db.getAllActionLogsByUser(req.user.id);
        return res.status(200).json({ success: true, data: logs });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// POST /orgs/:id/disconnect  –  Disconnect an org (in-memory only; keeps DB record)
// ─────────────────────────────────────────────────────────────────────────────

const handleDisconnectOrg = async (req, res) => {
    try {
        const org = db.getOrgById(req.params.id);
        if (!org || org.user_id !== req.user.id) {
            return res.status(404).json({ success: false, message: 'Org not found.' });
        }
        if (org.sf_org_id) connectionMap.delete(org.sf_org_id);
        db.updateOrgStatus(org.id, { status: 'disconnected', sfOrgId: org.sf_org_id });
        return res.status(200).json({ success: true, message: 'Org disconnected.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /orgs/:id  –  Permanently delete an org and related data
// ─────────────────────────────────────────────────────────────────────────────

const handleDeleteOrg = async (req, res) => {
    try {
        const org = db.getOrgById(req.params.id);
        if (!org || org.user_id !== req.user.id) {
            return res.status(404).json({ success: false, message: 'Org not found.' });
        }

        if (org.sf_org_id) {
            connectionMap.delete(org.sf_org_id);
        }

        const deleted = db.deleteOrg(org.id);
        if (!deleted) {
            return res.status(500).json({ success: false, message: 'Failed to delete org.' });
        }

        return res.status(200).json({
            success: true,
            message: 'Org deleted successfully',
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Server-start: auto-reconnect all previously-connected orgs
// ─────────────────────────────────────────────────────────────────────────────

const initializeConnections = async () => {
    const orgs = db.getAllConnectedOrgs();
    if (!orgs.length) return;
    console.log(`[initializeConnections] Attempting to reconnect ${orgs.length} org(s)...`);
    for (const org of orgs) {
        try {
            const { storedAuthType, reconnectType, reconnectConfig } = buildReconnectAuthInput(org);
            const svc = new SalesforceMetadataService({
                apiVersion: '60.0',
                loginUrl: defaultLoginUrlForEnvironment(org.environment),
            });

            const { userInfo } = await svc.connect({
                type: reconnectType,
                ...reconnectConfig,
            });

            const sfOrgId = await resolveSfOrgId(svc, userInfo);
            const persistedAuthConfig = buildPersistableAuthConfig(storedAuthType, reconnectConfig, svc);
            const dbAuthFields = buildDbAuthFields(persistedAuthConfig);

            if (org.sf_org_id && org.sf_org_id !== sfOrgId) {
                connectionMap.delete(org.sf_org_id);
            }

            connectionMap.set(sfOrgId, svc);
            db.updateOrgConnection(org.id, {
                instanceUrl: persistedAuthConfig.instanceUrl || org.instance_url,
                clientId: persistedAuthConfig.clientId || org.client_id || '',
                clientSecret: persistedAuthConfig.clientSecret || org.client_secret || '',
                authType: storedAuthType,
                authFields: dbAuthFields,
            });
            db.updateOrgStatus(org.id, { status: 'connected', sfOrgId });
            console.log(`[initializeConnections] Reconnected: ${org.name} (${sfOrgId}) via ${storedAuthType}`);
        } catch (err) {
            db.updateOrgStatus(org.id, { status: 'disconnected', sfOrgId: org.sf_org_id });
            console.warn(`[initializeConnections] Failed to reconnect ${org.name}: ${err.message}`);
        }
    }
};

module.exports = {
    handleORGConnection,
    handleGetOrgs,
    handleGetResources,
    handleConversation,
    handleGetSessions,
    handleGetSessionsBySfOrg,
    handleGetMessages,
    handleDeleteSession,
    handleGetActionLogs,
    handleGetAllActionLogs,
    handleDisconnectOrg,
    handleDeleteOrg,
    initializeConnections,
};
