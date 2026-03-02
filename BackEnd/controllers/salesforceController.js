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

// ─────────────────────────────────────────────────────────────────────────────
// POST /connect  –  Connect a Salesforce org
// ─────────────────────────────────────────────────────────────────────────────

const handleORGConnection = async (req, res) => {
    try {
        const { name, instanceUrl, clientId, clientSecret, environment } = req.body;
        const userId = req.user.id;

        if (!instanceUrl || !clientId || !clientSecret) {
            return res.status(400).json({
                success: false,
                message: 'instanceUrl, clientId, and clientSecret are required',
            });
        }

        const svc = new SalesforceMetadataService({ apiVersion: '60.0' });

        const { userInfo } = await svc.connect({
            type: AUTH_TYPES.CLIENT_CREDENTIALS,
            clientId,
            clientSecret,
            instanceUrl,
        });

        const sfOrgId = userInfo['organizationId'];

        // Persist or update org record
        let orgRecord = db.getOrgByUserAndInstance(userId, instanceUrl);
        if (!orgRecord) {
            orgRecord = db.createOrg({
                id:           uuidv4(),
                userId,
                name:         name || instanceUrl,
                instanceUrl,
                clientId,
                clientSecret,
                environment:  environment || 'Sandbox',
            });
        }
        db.updateOrgStatus(orgRecord.id, { status: 'connected', sfOrgId });

        // Keep live connection in memory
        connectionMap.set(sfOrgId, svc);

        return res.status(200).json({
            success: true,
            message: 'Connected to Salesforce successfully',
            data: {
                org:     { ...orgRecord, status: 'connected', sf_org_id: sfOrgId },
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
        const orgs = db.getOrgsByUser(req.user.id).map(o => ({
            ...o,
            isLive: connectionMap.has(o.sf_org_id),
            // Never send credentials to the client
            client_secret: undefined,
        }));
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
// Server-start: auto-reconnect all previously-connected orgs
// ─────────────────────────────────────────────────────────────────────────────

const initializeConnections = async () => {
    const orgs = db.getAllConnectedOrgs();
    if (!orgs.length) return;
    console.log(`[initializeConnections] Attempting to reconnect ${orgs.length} org(s)…`);
    for (const org of orgs) {
        try {
            const svc = new SalesforceMetadataService({ apiVersion: '60.0' });
            const { userInfo } = await svc.connect({
                type:         AUTH_TYPES.CLIENT_CREDENTIALS,
                clientId:     org.client_id,
                clientSecret: org.client_secret,
                instanceUrl:  org.instance_url,
            });
            const sfOrgId = userInfo['organizationId'];
            connectionMap.set(sfOrgId, svc);
            db.updateOrgStatus(org.id, { status: 'connected', sfOrgId });
            console.log(`[initializeConnections] ✓ Reconnected: ${org.name} (${sfOrgId})`);
        } catch (err) {
            db.updateOrgStatus(org.id, { status: 'disconnected', sfOrgId: org.sf_org_id });
            console.warn(`[initializeConnections] ✗ Failed to reconnect ${org.name}: ${err.message}`);
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
    initializeConnections,
};
