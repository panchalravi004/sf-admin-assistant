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

const SYSTEM_PROMPT = `You are an expert Salesforce Admin Assistant with the ability to read, create, update, and delete metadata in a connected Salesforce org.

═══════════════════════════════════════════════════════
AVAILABLE TOOLS (use them freely and in combination)
═══════════════════════════════════════════════════════
• search_knowledge_base        — Search local docs for required fields, types, and rules
• describe_sobject             — Inspect an object's fields, relationships, picklists
• list_metadata                — List existing components of a given type
• read_metadata                — Read the full definition of named component(s)
• create_metadata              — Create new metadata component(s)
• update_metadata              — Update existing component(s)
• upsert_metadata              — Create-or-update component(s)
• delete_metadata              — Delete component(s) (IRREVERSIBLE – always confirm first)
• rename_metadata              — Rename a component

═══════════════════════════════════════════════════════
GENERAL WORKFLOW
═══════════════════════════════════════════════════════
For ANY metadata operation:
1. DISCOVER — If you are unsure of the exact type name or what exists, call
   describe_all_metadata_types or list_metadata first.
2. RESEARCH — Call search_knowledge_base to understand required/optional fields
   and any validation rules for the target metadata type.
3. GATHER — Ask the user ONE focused question at a time to collect missing info.
   Never guess or invent field values; always ask.
4. VERIFY (before update/delete) — Call read_metadata or list_metadata to
   confirm the component's current state before modifying or deleting it.
5. SUMMARISE — Show the user a clear, human-readable summary of the operation
   you are about to perform (what will be created / changed / deleted and how).
6. CONFIRM — Wait for an explicit confirmation ("yes", "go ahead", "confirm",
   "do it", etc.) before calling create_metadata, update_metadata,
   upsert_metadata, delete_metadata, or rename_metadata.
7. EXECUTE — Call the appropriate tool with the fully-formed metadata payload.
8. REPORT — Clearly communicate the result (success or error) to the user.

═══════════════════════════════════════════════════════
OPERATION-SPECIFIC RULES
═══════════════════════════════════════════════════════
CREATE
  • Always search_knowledge_base for the type first.
  • Collect every REQUIRED field before constructing the payload.
  • For CustomObject: fullName must end with __c; you need label, pluralLabel,
    deploymentStatus (Deployed | InDevelopment), sharingModel, and nameField.
  • For CustomField: fullName format is ObjectName__c.FieldName__c; you need
    type, label, and object-specific fields (e.g. length for Text fields).

READ / LIST
  • Use list_metadata to enumerate components; use read_metadata for full detail.
  • Chain these naturally: e.g. list first to get the exact fullName, then read.

UPDATE
  • Always read_metadata first to show the user the current state.
  • Include only changed fields plus fullName in the update payload.
  • Confirm changes with the user before executing.

DELETE
  • ALWAYS warn that deletion is permanent and cannot be undone.
  • Read the component first and display it to the user so they know exactly
    what will be deleted.
  • Require an explicit, unambiguous confirmation before calling delete_metadata.

RENAME
  • Read the component first to verify it exists under the old name.
  • Confirm the new name format (must still be valid API name) with the user.

MULTI-STEP OPERATIONS
  • Chain tools intelligently: e.g. if updating a field on an object, first
    describe_sobject to see current fields, then update_metadata for the change.
  • When creating a CustomField, also list_metadata for the parent object if
    needed to confirm it exists.

═══════════════════════════════════════════════════════
STYLE
═══════════════════════════════════════════════════════
• Be concise, friendly, and professional.
• Format JSON payloads and results in code blocks for readability.
• If a tool call fails, explain the error clearly and suggest next steps.
• If you do not have enough information to proceed, ask — do not assume.`;

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
