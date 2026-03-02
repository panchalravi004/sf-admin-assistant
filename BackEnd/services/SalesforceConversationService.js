'use strict';

/**
 * SalesforceConversationService
 *
 * Manages multi-turn AI conversations scoped to a Salesforce org connection.
 * Each sessionId gets an isolated AIConversationManager pre-loaded with:
 *   - All Salesforce CRUD tools (via buildSalesforceTools), instrumented for action logging
 *   - A keyword-scored metadata knowledge base search function
 *   - A rich system prompt covering every metadata operation
 *
 * Public API:
 *   const svc = new SalesforceConversationService();
 *   const result = await svc.chat({ orgId, sessionId, inputText, sfSvc, onActionLog });
 *   svc.deleteSession(sessionId);
 *   svc.listSessions();
 */

const fs   = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { tool }       = require('@langchain/core/tools');
const AIConversationManager  = require('./AIConversationManager');
const { buildSalesforceTools } = require('../controllers/salesforceTools');

// ─────────────────────────────────────────────────────────────────────────────
// KNOWLEDGE BASE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lazily loads all *.json files from metadata-scraper/output/ and converts
 * each one into a rich text chunk that the AI can consume.
 */
class MetadataKnowledgeBase {
    constructor() {
        this._chunks = null;
        this._outputDir = path.join(__dirname, '../knowledge');
    }

    /** Load (once) and return all knowledge chunks. */
    load() {
        if (this._chunks) return this._chunks;

        this._chunks = [];

        try {
            const files = fs.readdirSync(this._outputDir).filter(f => f.endsWith('.json'));

            for (const file of files) {
                const data = JSON.parse(
                    fs.readFileSync(path.join(this._outputDir, file), 'utf8')
                );
                this._chunks.push(this._toChunk(data));
            }

            console.log(`[MetadataKnowledgeBase] Loaded ${this._chunks.length} type(s) from ${this._outputDir}`);
        } catch (e) {
            console.warn(`[MetadataKnowledgeBase] Could not load metadata files: ${e.message}`);
        }

        return this._chunks;
    }

    /** Convert a parsed JSON doc into a searchable text chunk. */
    _toChunk(data) {
        const requiredFields  = (data.requiredFields  || []).join(', ');
        const optionalFields  = (data.optionalFields  || []).join(', ');

        const fieldDetails = (data.fields || [])
            .map(f =>
                `  - ${f.name} (${f.type}${f.required ? ', REQUIRED' : ''}): ${f.description || ''}`
            )
            .join('\n');

        const rules = (data.verificationRules || [])
            .map(r => `  • ${r}`)
            .join('\n');

        const childTypes = (data.childTypes || []).join(', ');

        const text = [
            `Metadata Type: ${data.metadataType}`,
            `Description: ${data.description || '(none)'}`,
            `Required fields: ${requiredFields || '(none)'}`,
            `Optional fields: ${optionalFields || '(none)'}`,
            fieldDetails  ? `Field details:\n${fieldDetails}` : '',
            rules         ? `Verification rules:\n${rules}`    : '',
            childTypes    ? `Child types: ${childTypes}`        : '',
            data.supportsWildcard !== undefined
                ? `Supports wildcard (*): ${data.supportsWildcard}`
                : '',
        ].filter(Boolean).join('\n');

        return {
            metadataType: data.metadataType,
            raw:          data,
            content:      text,
        };
    }

    /**
     * Keyword-scored search – returns top-k matching chunks.
     * Compatible with the AIConversationManager's vectorSearchFn signature.
     *
     * @param {string} query
     * @param {number} [topK=3]
     * @returns {Promise<Array<{content: string}>>}
     */
    async search(query, topK = 3) {
        const chunks     = this.load();
        const queryWords = query.toLowerCase().split(/\W+/).filter(Boolean);

        const scored = chunks.map(chunk => {
            const lower = chunk.content.toLowerCase();
            const score = queryWords.reduce(
                (acc, word) => acc + (lower.includes(word) ? 1 : 0),
                0
            );
            return { content: chunk.content, score };
        });

        return scored
            .filter(c => c.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .map(c => ({ content: c.content }));
    }
}

// Singleton knowledge base (shared across all sessions)
const knowledgeBase = new MetadataKnowledgeBase();

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a Salesforce Admin AI. You manage metadata in a connected org via tools.

TOOLS:
• validate_metadata_type  — ALWAYS call first when user provides a type name
• search_knowledge_base   — Search local docs for required fields, types, and rules
• list_metadata           — List existing components of a type
• read_metadata           — Read full definition of named components
• create_metadata         — Create components (confirm with user first)
• update_metadata         — Update components (read first, then confirm)
• upsert_metadata         — Create-or-update components
• delete_metadata         — Delete components (IRREVERSIBLE – confirm first)
• rename_metadata         — Rename a component (confirm first)
• describe_sobject        — Inspect SObject fields, picklists, relationships

WORKFLOW: validate type → search_knowledge_base → gather missing info (ask, never guess) → summarize what will change → confirm → execute → report result.

KEY RULES:
• Never invent field values — always ask the user for missing info.
• Mutate operations (create/update/upsert/delete/rename) require explicit user confirmation.
• DELETE: warn it is permanent, read the component first, require an unambiguous "yes".
• CustomObject fullName ends with __c; required: label, pluralLabel, deploymentStatus, sharingModel, nameField.
• CustomField fullName = ParentObj__c.FieldName__c; required: type + label + type-specific attrs.
• Chain tools: list → read → modify is the safe pattern for updates.`;

// • describe_all_metadata_types  — List every metadata type available in the org
// • describe_global              — List every SObject in the org (API names, labels)

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class SalesforceConversationService {
    constructor() {
        /**
         * Map of sessionId → { manager: AIConversationManager, history: Array, orgId: string }
         * @type {Map<string, {manager: AIConversationManager, history: Array, orgId: string, createdAt: Date}>}
         */
        this._sessions = new Map();
    }

    // ── Tool instrumentation ──────────────────────────────────────────────────

    /**
     * Wrap a tool to intercept calls and fire onActionLog before/after execution.
     * The session holds a mutable `logFn` reference updated on every chat() call.
     */
    _wrapTool(originalTool, session) {
        return tool(
            async (input) => {
                const logId = uuidv4();
                const start = Date.now();

                if (session.logFn) {
                    await session.logFn({
                        id:       logId,
                        toolName: originalTool.name,
                        params:   input,
                        status:   'pending',
                    });
                }

                try {
                    const result = await originalTool.invoke(input);
                    const duration = Date.now() - start;

                    if (session.logFn) {
                        await session.logFn({
                            id:       logId,
                            toolName: originalTool.name,
                            params:   input,
                            status:   'success',
                            result,
                            duration,
                        });
                    }
                    return result;
                } catch (err) {
                    const duration = Date.now() - start;

                    if (session.logFn) {
                        await session.logFn({
                            id:       logId,
                            toolName: originalTool.name,
                            params:   input,
                            status:   'error',
                            error:    err.message,
                            duration,
                        });
                    }
                    throw err;
                }
            },
            {
                name:        originalTool.name,
                description: originalTool.description,
                schema:      originalTool.schema,
            }
        );
    }

    // ── Session management ────────────────────────────────────────────────────

    /**
     * Create a brand-new in-memory session for the given org connection.
     */
    _createSession(sessionId, orgId, sfSvc) {
        const vectorSearchFn = (query) => knowledgeBase.search(query);

        const manager = new AIConversationManager(
            { model: 'gpt-4o-mini', temperature: 0.2, maxTokens: 2000 },
            vectorSearchFn
        );

        const session = {
            manager,
            history:   [],
            orgId,
            logFn:     null, // updated on every chat() call
            createdAt: new Date(),
        };

        // Inject instrumented Salesforce CRUD tools
        const rawTools = buildSalesforceTools(sfSvc);
        for (const t of rawTools) {
            manager.addTool(this._wrapTool(t, session));
        }

        this._sessions.set(sessionId, session);
        console.log(`[SalesforceConversationService] Session created: ${sessionId} (org: ${orgId})`);
        return session;
    }

    /**
     * Retrieve an existing session or create one.
     * @param {string} sessionId
     * @param {string} orgId
     * @param {import('./SalesforceMetadataService').SalesforceMetadataService} sfSvc
     */
    _getOrCreateSession(sessionId, orgId, sfSvc) {
        if (this._sessions.has(sessionId)) {
            return this._sessions.get(sessionId);
        }
        return this._createSession(sessionId, orgId, sfSvc);
    }

    /**
     * Delete a session (free memory).
     * @param {string} sessionId
     */
    deleteSession(sessionId) {
        const existed = this._sessions.delete(sessionId);
        if (existed) {
            console.log(`[SalesforceConversationService] Session deleted: ${sessionId}`);
        }
        return existed;
    }

    /**
     * List all active sessions with metadata.
     * @returns {Array<{sessionId: string, orgId: string, turns: number, createdAt: Date}>}
     */
    listSessions() {
        return Array.from(this._sessions.entries()).map(([sid, s]) => ({
            sessionId: sid,
            orgId:     s.orgId,
            turns:     Math.floor(s.history.length / 2),
            createdAt: s.createdAt,
        }));
    }

    // ── Main chat entry point ─────────────────────────────────────────────────

    /**
     * Process one conversational turn.
     *
     * @param {object} opts
     * @param {string}   opts.orgId       – Connected org SF ID (used as connectionMap key)
     * @param {string}   opts.sessionId   – Unique session identifier
     * @param {string}   opts.inputText   – User message
     * @param {import('./SalesforceMetadataService').SalesforceMetadataService} opts.sfSvc
     * @param {Function} [opts.onActionLog] – Callback({ id, toolName, params, status, result, error, duration })
     *
     * @returns {Promise<{response: string, sessionId: string, usage: object, turns: number}>}
     */
    async chat({ orgId, sessionId, inputText, sfSvc, onActionLog }) {
        const sid     = sessionId || orgId;
        const session = this._getOrCreateSession(sid, orgId, sfSvc);

        // Update the mutable logFn reference for this turn
        session.logFn = onActionLog || null;

        console.log(`[SalesforceConversationService] Chat | session=${sid} | turn=${Math.floor(session.history.length / 2) + 1}`);

        const result = await session.manager.generateResponse(
            inputText,
            session.history,
            SYSTEM_PROMPT
        );

        // Persist the turn
        session.history.push({ role: 'user',      message: inputText });
        session.history.push({ role: 'assistant', message: result.content });

        return {
            response:  result.content,
            sessionId: sid,
            usage:     result.usage,
            turns:     Math.floor(session.history.length / 2),
        };
    }
}

module.exports = SalesforceConversationService;
