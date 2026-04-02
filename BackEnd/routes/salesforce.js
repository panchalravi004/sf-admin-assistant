'use strict';

const express = require('express');
const {
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
} = require('../controllers/salesforceController');

const router = express.Router();

// Org connections
router.post('/connect',               handleORGConnection);
router.get('/orgs',                   handleGetOrgs);
router.post('/orgs/:id/disconnect',   handleDisconnectOrg);
router.delete('/orgs/:id',            handleDeleteOrg);
router.get('/get/resources',          handleGetResources);

// Conversation
router.post('/conversation',             handleConversation);
router.get('/sessions/sf/:sfOrgId',      handleGetSessionsBySfOrg);
router.get('/sessions/:orgId',           handleGetSessions);
router.get('/messages/:sessionId',       handleGetMessages);
router.delete('/sessions/:sessionId',    handleDeleteSession);

// Action logs
router.get('/logs',                  handleGetAllActionLogs);
router.get('/logs/:sessionId',       handleGetActionLogs);

module.exports = router;
