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
                'and (3) the user has explicitly confirmed (said "yes", "go ahead", "confirm", etc.). ' +
                'Supported types: CustomObject, CustomField, ApexClass, ApexTrigger, Flow, ' +
                'ValidationRule, PermissionSet, Profile, Layout, and any other valid Metadata API type.',
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
                'Call this only after confirming the changes with the user. ' +
                'The metadataJson must include the fullName field to identify the component.',
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
        describeSObject
        // describeGlobal,
    ];
};

module.exports = { buildSalesforceTools };
