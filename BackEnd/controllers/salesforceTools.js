'use strict';

/**
 * salesforceTools.js
 *
 * Builds a complete set of LangChain tools that wrap every relevant
 * SalesforceMetadataService method.  Call buildSalesforceTools(svc) with
 * a connected SalesforceMetadataService instance to get back an array of
 * tool objects ready to be injected into an AIConversationManager.
 *
 * Tools exposed:
 *   1.  describe_all_metadata_types   – list every type available in the org
 *   2.  list_metadata                 – list components of one or more types
 *   3.  read_metadata                 – read full definition of named components
 *   4.  create_metadata               – create new metadata components
 *   5.  update_metadata               – update existing metadata components
 *   6.  upsert_metadata               – create-or-update metadata components
 *   7.  delete_metadata               – delete metadata components
 *   8.  rename_metadata               – rename a single metadata component
 *   9.  describe_sobject              – describe an SObject (fields, etc.)
 *   10. describe_global               – list all SObjects in the org
 */

const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const path = require('path');

const VALID_METADATA_TYPES = require(path.join(__dirname, '../knowledge/validMetadataType.json'));

// ─── helpers ────────────────────────────────────────────────────────────────

const ok  = (data)  => JSON.stringify({ success: true,  result: data });
const err = (e)     => JSON.stringify({ success: false, error: e.message ?? String(e) });

const safeRun = async (label, fn) => {
    try {
        console.log(`[Tool: ${label}] invoked`);
        const result = await fn();
        console.log(`[Tool: ${label}] success`);
        return ok(result);
    } catch (e) {
        console.error(`[Tool: ${label}] error:`, e.message);
        return err(e);
    }
};

// ─── tool factory ────────────────────────────────────────────────────────────

/**
 * @param {import('../services/SalesforceMetadataService').SalesforceMetadataService} svc
 * @returns {import('@langchain/core/tools').DynamicStructuredTool[]}
 */
const buildSalesforceTools = (svc) => {

    // ── 0. Validate metadata type ─────────────────────────────────────────────
    const validateMetadataType = tool(
        async ({ metadataType }) => {
            const normalised = metadataType?.trim();
            const valid = VALID_METADATA_TYPES.includes(normalised);
            if (valid) {
                return JSON.stringify({ valid: true, metadataType: normalised });
            }
            const suggestions = VALID_METADATA_TYPES.filter(t =>
                t.toLowerCase().includes(normalised.toLowerCase())
            );
            return JSON.stringify({
                valid: false,
                metadataType: normalised,
                message: `"${normalised}" is not a supported metadata type.`,
                suggestions: suggestions.length ? suggestions : VALID_METADATA_TYPES,
            });
        },
        {
            name: 'validate_metadata_type',
            description:
                'Check whether a metadata type name is supported before performing any ' +
                'list, read, create, update, upsert, delete, or rename operation. ' +
                'ALWAYS call this tool first when the user provides a metadata type. ' +
                'If the result is valid:false, show the user the suggestions and ask them ' +
                'to confirm the correct type before proceeding.',
            schema: z.object({
                metadataType: z.string()
                    .describe('The metadata type name to validate, e.g. "CustomObject", "ApexClass".'),
            }),
        }
    );

    // ── 1. Describe all metadata types ────────────────────────────────────────
    // const describeAllMetadataTypes = tool(
    //     async ({ apiVersion }) => safeRun('describe_all_metadata_types', () =>
    //         svc.describeMetadata(apiVersion)
    //     ),
    //     {
    //         name: 'describe_all_metadata_types',
    //         description:
    //             'List every metadata type available in the connected Salesforce org ' +
    //             '(e.g. CustomObject, ApexClass, Flow, PermissionSet, etc.). ' +
    //             'Use this when you need to discover what types exist or validate that a type name is correct.',
    //         schema: z.object({
    //             apiVersion: z.string().optional()
    //                 .describe('Optional Salesforce API version override, e.g. "60.0".'),
    //         }),
    //     }
    // );

    // ── 2. List metadata ──────────────────────────────────────────────────────
    const listMetadata = tool(
        async ({ metadataType }) => safeRun('list_metadata', () => {
            console.log('[listMetadata] metadataType input:', metadataType);
            const types = [{ type: metadataType, folder: undefined }];
            return svc.listMetadata(types, null);
        }),
        {
            name: 'list_metadata',
            description:
                'List summary information (names, labels, last-modified dates) for metadata components ' +
                'of a given type. Use this to see what components already exist before creating or ' +
                'updating, and to verify whether a component with a given name already exists.',
            schema: z.object({
                metadataType: z.string().describe('The metadata type to list, e.g. "CustomObject", "ApexClass", "CustomField".')
            }),
        }
    );

    // ── 3. Read metadata ──────────────────────────────────────────────────────
    const readMetadata = tool(
        async ({ metadataType, fullNames }) => safeRun('read_metadata', () => {
            console.log('[readMetadata] fullNames input:', metadataType, fullNames);
            const names = typeof fullNames === 'string'
                ? fullNames.split(',').map(n => n.trim())
                : fullNames;
            return svc.readMetadata(metadataType, names);
        }),
        {
            name: 'read_metadata',
            description:
                'Read the full definition of one or more named metadata components. ' +
                'Use this to inspect an existing component before deciding to update or delete it, ' +
                'or to confirm its current state. Always read before updating if the user wants to ' +
                'verify the current configuration.',
            schema: z.object({
                metadataType: z.string()
                    .describe('Metadata type, e.g. "CustomObject", "ApexClass", "CustomField".'),
                fullNames: z.string()
                    .describe(
                        'Comma-separated API names of the components, ' +
                        'e.g. "Account,Contact" or "MyObj__c.MyField__c".'
                    ),
            }),
        }
    );

    // ── 4. Create metadata ────────────────────────────────────────────────────
    const createMetadata = tool(
        async ({ metadataType, metadataJson }) => safeRun('create_metadata', () => {
            console.log('[createMetadata] metadataJson input:', metadataType, metadataJson);
            const metadata = typeof metadataJson === 'string'
                ? JSON.parse(metadataJson)
                : metadataJson;
            return svc.createMetadata(metadataType, metadata);
        }),
        {
            name: 'create_metadata',
            description:
                'Create one or more Salesforce metadata components in the connected org. ' +
                'Call this ONLY after: (1) you have confirmed every required field with the user, ' +
                '(2) you have shown the user a clear summary of what will be created, ' +
                'and (3) the user has explicitly confirmed (said "yes", "go ahead", "confirm", etc.). ',
            schema: z.object({
                metadataType: z.string()
                    .describe('Salesforce metadata type, e.g. "CustomObject" or "CustomField".'),
                metadataJson: z.string()
                    .describe(
                        'JSON string with the metadata definition. ' +
                        'For a single component pass an object; ' +
                        'for multiple components pass an array of objects. ' +
                        'All required fields for the type must be present.'
                    ),
            }),
        }
    );

    // ── 5. Update metadata ────────────────────────────────────────────────────
    const updateMetadata = tool(
        async ({ metadataType, metadataJson }) => safeRun('update_metadata', () => {
            console.log('[updateMetadata] metadataJson input:', metadataType, metadataJson);
            const metadata = typeof metadataJson === 'string'
                ? JSON.parse(metadataJson)
                : metadataJson;
            return svc.updateMetadata(metadataType, metadata);
        }),
        {
            name: 'update_metadata',
            description:
                'Update one or more existing Salesforce metadata components. ' +
                'Always use read_metadata first to inspect the current state. ' +
                'Call this only after confirming the changes with the user. ',
            schema: z.object({
                metadataType: z.string()
                    .describe('Salesforce metadata type, e.g. "CustomField", "ValidationRule".'),
                metadataJson: z.string()
                    .describe(
                        'JSON string with updated metadata. Must include "fullName". ' +
                        'Only include fields you want to change plus fullName.'
                    ),
            }),
        }
    );

    // ── 6. Upsert metadata ────────────────────────────────────────────────────
    const upsertMetadata = tool(
        async ({ metadataType, metadataJson }) => safeRun('upsert_metadata', () => {
            console.log('[upsertMetadata] metadataJson input:', metadataType, metadataJson);
            const metadata = typeof metadataJson === 'string'
                ? JSON.parse(metadataJson)
                : metadataJson;
            return svc.upsertMetadata(metadataType, metadata);
        }),
        {
            name: 'upsert_metadata',
            description:
                'Create-or-update (upsert) Salesforce metadata components. ' +
                'Use this when you are unsure whether the component already exists. ' +
                'The result includes a "created" flag indicating whether each component was new.',
            schema: z.object({
                metadataType: z.string()
                    .describe('Salesforce metadata type.'),
                metadataJson: z.string()
                    .describe('JSON string with the full metadata definition(s).'),
            }),
        }
    );

    // ── 7. Delete metadata ────────────────────────────────────────────────────
    const deleteMetadata = tool(
        async ({ metadataType, fullNames }) => safeRun('delete_metadata', () => {
            console.log('[deleteMetadata] fullNames input:', metadataType, fullNames);
            const names = typeof fullNames === 'string'
                ? fullNames.split(',').map(n => n.trim())
                : fullNames;
            return svc.deleteMetadata(metadataType, names);
        }),
        {
            name: 'delete_metadata',
            description:
                'Delete one or more Salesforce metadata components. ' +
                'This is IRREVERSIBLE. Always: (1) read the component first to confirm it exists, ' +
                '(2) clearly warn the user that deletion cannot be undone, ' +
                '(3) require explicit confirmation before calling this tool. ' +
                'Never delete without an unambiguous "yes, delete it" from the user.',
            schema: z.object({
                metadataType: z.string()
                    .describe('Salesforce metadata type.'),
                fullNames: z.string()
                    .describe('Comma-separated API names of the components to delete.'),
            }),
        }
    );

    // ── 8. Rename metadata ────────────────────────────────────────────────────
    const renameMetadata = tool(
        async ({ metadataType, oldFullName, newFullName }) => safeRun('rename_metadata', () => {
            console.log('[renameMetadata] input:', metadataType, oldFullName, newFullName);
            return svc.renameMetadata(metadataType, oldFullName, newFullName)
        }),
        {
            name: 'rename_metadata',
            description:
                'Rename a single Salesforce metadata component. ' +
                'Use read_metadata first to confirm the component exists under the old name. ' +
                'Confirm the new name with the user before calling this tool.',
            schema: z.object({
                metadataType: z.string()
                    .describe('Salesforce metadata type.'),
                oldFullName: z.string()
                    .describe('Current API name of the component.'),
                newFullName: z.string()
                    .describe('New API name for the component.'),
            }),
        }
    );

    // ── 9. Describe SObject ───────────────────────────────────────────────────
    const describeSObject = tool(
        async ({ sobjectType }) => safeRun('describe_sobject', () => {
            console.log('[describeSObject] sobjectType input:', sobjectType);
            return svc.describeSObject(sobjectType)
        }),
        {
            name: 'describe_sobject',
            description:
                'Describe an SObject: returns all fields, their types, picklist values, ' +
                'relationships, and other properties. Use this to explore an existing object ' +
                'before adding fields or to answer questions about an object\'s structure.',
            schema: z.object({
                sobjectType: z.string()
                    .describe('API name of the SObject, e.g. "Account", "Contact", "MyObj__c".'),
            }),
        }
    );

    // ── 10. Query records (SOQL) ──────────────────────────────────────────────
    const queryRecords = tool(
        async ({ soql, maxRecords }) => safeRun('query_records', () => {
            console.log('[queryRecords] soql:', soql);
            return svc.queryRecords(soql, { maxRecords: maxRecords || 200 });
        }),
        {
            name: 'query_records',
            description:
                'Run a SOQL query and return matching records. ' +
                'Build precise SOQL from user intent; always include Id plus the requested fields. ' +
                'Use WHERE, ORDER BY, and LIMIT to keep results focused.',
            schema: z.object({
                soql: z.string().describe('Full SOQL query, e.g. "SELECT Id, Name FROM Account WHERE Industry = \'Tech\' LIMIT 50".'),
                maxRecords: z.number().int().min(1).max(2000).optional().describe('Max records to return (default 200, max 2000).'),
            }),
        }
    );

    // ── 11. Retrieve records by ID ──────────────────────────────────────────
    const retrieveRecords = tool(
        async ({ sobjectType, ids }) => safeRun('retrieve_records', () => {
            const idList = typeof ids === 'string' ? ids.split(',').map(s => s.trim()) : ids;
            return svc.retrieveRecords(sobjectType, idList);
        }),
        {
            name: 'retrieve_records',
            description: 'Fetch one or more SObject records by Salesforce ID. Returns all fields for each record.',
            schema: z.object({
                sobjectType: z.string().describe('SObject API name, e.g. "Account", "Contact".'),
                ids: z.string().describe('Comma-separated Salesforce record IDs.'),
            }),
        }
    );

    // ── 12. Create records ──────────────────────────────────────────────────
    const createRecords = tool(
        async ({ sobjectType, recordsJson }) => safeRun('create_records', () => {
            const records = typeof recordsJson === 'string' ? JSON.parse(recordsJson) : recordsJson;
            return svc.createRecords(sobjectType, records);
        }),
        {
            name: 'create_records',
            description:
                'Create one or more SObject records. ' +
                'Confirm field values with the user before calling. ' +
                'Returns an array of results with id and success flag.',
            schema: z.object({
                sobjectType: z.string().describe('SObject API name.'),
                recordsJson: z.string().describe('JSON array of record objects, e.g. [{"Name":"Acme"}].'),
            }),
        }
    );

    // ── 13. Update records ──────────────────────────────────────────────────
    const updateRecords = tool(
        async ({ sobjectType, recordsJson }) => safeRun('update_records', () => {
            const records = typeof recordsJson === 'string' ? JSON.parse(recordsJson) : recordsJson;
            return svc.updateRecords(sobjectType, records);
        }),
        {
            name: 'update_records',
            description:
                'Update one or more existing SObject records. Each record must include its Id. ' +
                'Retrieve records first to confirm current values, then confirm changes with the user.',
            schema: z.object({
                sobjectType: z.string().describe('SObject API name.'),
                recordsJson: z.string().describe('JSON array of record objects each with an Id field, e.g. [{"Id":"001...","Name":"New"}].'),
            }),
        }
    );

    // ── 14. Upsert records ──────────────────────────────────────────────────
    const upsertRecords = tool(
        async ({ sobjectType, recordsJson, externalIdField, allOrNone }) => safeRun('upsert_records', () => {
            const records = typeof recordsJson === 'string' ? JSON.parse(recordsJson) : recordsJson;
            return svc.upsertRecords(sobjectType, records, externalIdField, { allOrNone: allOrNone || false });
        }),
        {
            name: 'upsert_records',
            description:
                'Create-or-update SObject records matched by an external ID field. ' +
                'Confirm the external ID field and record values with the user first.',
            schema: z.object({
                sobjectType: z.string().describe('SObject API name.'),
                recordsJson: z.string().describe('JSON array of record objects including the external ID field value.'),
                externalIdField: z.string().describe('API name of the external ID field used to match existing records, e.g. "ExtId__c".'),
                allOrNone: z.boolean().optional().describe('If true, roll back all records on any single failure (default false).'),
            }),
        }
    );

    // ── 15. Delete records ──────────────────────────────────────────────────
    const deleteRecords = tool(
        async ({ sobjectType, ids }) => safeRun('delete_records', () => {
            const idList = typeof ids === 'string' ? ids.split(',').map(s => s.trim()) : ids;
            return svc.deleteRecords(sobjectType, idList);
        }),
        {
            name: 'delete_records',
            description:
                'Delete one or more SObject records by ID. IRREVERSIBLE. ' +
                'Always retrieve records first, warn the user, and require explicit confirmation.',
            schema: z.object({
                sobjectType: z.string().describe('SObject API name.'),
                ids: z.string().describe('Comma-separated Salesforce record IDs to delete.'),
            }),
        }
    );

    // ── 10. Describe global (all SObjects) ────────────────────────────────────
    // const describeGlobal = tool(
    //     async () => safeRun('describe_global', () => svc.describeGlobal()),
    //     {
    //         name: 'describe_global',
    //         description:
    //             'List every SObject available in the org with basic metadata ' +
    //             '(name, label, queryable, etc.). Use this when the user asks what objects ' +
    //             'exist or when you need to find the API name of an object.',
    //         schema: z.object({}),
    //     }
    // );

    return [
        validateMetadataType,
        // describeAllMetadataTypes,
        listMetadata,
        readMetadata,
        createMetadata,
        updateMetadata,
        upsertMetadata,
        deleteMetadata,
        renameMetadata,
        describeSObject,
        queryRecords,
        retrieveRecords,
        createRecords,
        updateRecords,
        upsertRecords,
        deleteRecords,
        // describeGlobal,
    ];
};

module.exports = { buildSalesforceTools };
