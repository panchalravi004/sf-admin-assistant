/**
 * SalesforceMetadataService
 *
 * A service class that wraps jsforce's Metadata API with support for
 * multiple authentication strategies:
 *
 *  1. usernamePassword          – SOAP login (no OAuth2 client required)
 *  2. usernamePasswordOAuth     – OAuth2 Resource Owner Password Credential flow
 *  3. sessionId                 – existing Session ID + instance URL
 *  4. accessToken               – existing Access Token + instance URL
 *  5. accessTokenWithRefresh    – Access Token + Refresh Token (auto-refresh)
 *  6. authorizationCode         – OAuth2 Authorization Code flow (server-side)
 *  7. jwtBearer                 – OAuth2 JWT Bearer flow
 *  8. clientCredentials         – OAuth2 Client Credentials flow
 *
 * Usage:
 *   const svc = new SalesforceMetadataService();
 *   await svc.connect({ type: 'clientCredentials', clientId, clientSecret, instanceUrl });
 *   const meta = await svc.describeMetadata();
 */

'use strict';

const jsforce = require('jsforce');

// Optional – only needed for the JWT Bearer auth type
let jwt;
try {
  jwt = require('jsonwebtoken');
} catch {
  jwt = null;
}

/**
 * Supported authentication strategy identifiers.
 */
const AUTH_TYPES = {
  USERNAME_PASSWORD: 'usernamePassword',
  USERNAME_PASSWORD_OAUTH: 'usernamePasswordOAuth',
  SESSION_ID: 'sessionId',
  ACCESS_TOKEN: 'accessToken',
  ACCESS_TOKEN_WITH_REFRESH: 'accessTokenWithRefresh',
  AUTHORIZATION_CODE: 'authorizationCode',
  JWT_BEARER: 'jwtBearer',
  CLIENT_CREDENTIALS: 'clientCredentials',
};

class SalesforceMetadataService {
  /**
   * @param {object} [options]
   * @param {string} [options.apiVersion='60.0']  – Salesforce API version
   * @param {string} [options.loginUrl]            – Override login URL (e.g. sandbox)
   */
  constructor(options = {}) {
    this.apiVersion = options.apiVersion || '60.0';
    this.loginUrl = options.loginUrl || 'https://login.salesforce.com';
    /** @type {jsforce.Connection|null} */
    this.conn = null;
    /** @type {object|null} Salesforce user info returned after login */
    this.userInfo = null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONNECTION / AUTHENTICATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Establish a Salesforce connection using the specified authentication strategy.
   *
   * @param {object} authConfig
   * @param {string} authConfig.type - One of the AUTH_TYPES values
   *
   * --- usernamePassword ---
   * @param {string} [authConfig.username]
   * @param {string} [authConfig.password]  Include security token appended to password if required
   * @param {string} [authConfig.loginUrl]  Override login URL
   *
   * --- usernamePasswordOAuth ---
   * @param {string} [authConfig.username]
   * @param {string} [authConfig.password]  Append security token if required
   * @param {string} [authConfig.clientId]
   * @param {string} [authConfig.clientSecret]
   * @param {string} [authConfig.redirectUri]
   * @param {string} [authConfig.loginUrl]
   *
   * --- sessionId ---
   * @param {string} [authConfig.sessionId]
   * @param {string} [authConfig.instanceUrl]
   *
   * --- accessToken ---
   * @param {string} [authConfig.accessToken]
   * @param {string} [authConfig.instanceUrl]
   *
   * --- accessTokenWithRefresh ---
   * @param {string} [authConfig.accessToken]
   * @param {string} [authConfig.refreshToken]
   * @param {string} [authConfig.instanceUrl]
   * @param {string} [authConfig.clientId]
   * @param {string} [authConfig.clientSecret]
   * @param {string} [authConfig.redirectUri]
   * @param {function} [authConfig.onRefresh]  Callback(newAccessToken) fired on token refresh
   *
   * --- authorizationCode ---
   * @param {string} [authConfig.code]         Authorization code from Salesforce callback
   * @param {string} [authConfig.clientId]
   * @param {string} [authConfig.clientSecret]
   * @param {string} [authConfig.redirectUri]
   * @param {string} [authConfig.loginUrl]
   *
   * --- jwtBearer ---
   * @param {string} [authConfig.clientId]     Connected App client ID (issuer)
   * @param {string} [authConfig.privateKey]   PEM-encoded RSA private key (string or Buffer)
   * @param {string} [authConfig.username]     Salesforce username (subject)
   * @param {string} [authConfig.audience]     'https://login.salesforce.com' or 'https://test.salesforce.com'
   * @param {string} [authConfig.loginUrl]
   *
   * --- clientCredentials ---
   * @param {string} [authConfig.clientId]
   * @param {string} [authConfig.clientSecret]
   * @param {string} [authConfig.instanceUrl]
   * @param {string} [authConfig.loginUrl]
   *
   * @returns {Promise<object>} userInfo / connection info
   */
  async connect(authConfig) {
    const { type } = authConfig;

    switch (type) {
      case AUTH_TYPES.USERNAME_PASSWORD:
        await this._connectUsernamePassword(authConfig);
        break;

      case AUTH_TYPES.USERNAME_PASSWORD_OAUTH:
        await this._connectUsernamePasswordOAuth(authConfig);
        break;

      case AUTH_TYPES.SESSION_ID:
        this._connectSessionId(authConfig);
        break;

      case AUTH_TYPES.ACCESS_TOKEN:
        this._connectAccessToken(authConfig);
        break;

      case AUTH_TYPES.ACCESS_TOKEN_WITH_REFRESH:
        this._connectAccessTokenWithRefresh(authConfig);
        break;

      case AUTH_TYPES.AUTHORIZATION_CODE:
        await this._connectAuthorizationCode(authConfig);
        break;

      case AUTH_TYPES.JWT_BEARER:
        await this._connectJwtBearer(authConfig);
        break;

      case AUTH_TYPES.CLIENT_CREDENTIALS:
        await this._connectClientCredentials(authConfig);
        break;

      default:
        throw new Error(
          `Unsupported authentication type: "${type}". ` +
          `Valid types: ${Object.values(AUTH_TYPES).join(', ')}`
        );
    }

    return {
      userInfo: this.userInfo,
      instanceUrl: this.conn.instanceUrl,
      accessToken: this.conn.accessToken,
    };
  }

  /**
   * Disconnect / logout from Salesforce and clear the internal connection.
   */
  async disconnect() {
    if (this.conn) {
      await this.conn.logout();
      this.conn = null;
      this.userInfo = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE AUTH STRATEGIES
  // ─────────────────────────────────────────────────────────────────────────────

  /** 1. Username + Password (SOAP – no OAuth client needed) */
  async _connectUsernamePassword({ username, password, loginUrl }) {
    this.conn = new jsforce.Connection({
      loginUrl: loginUrl || this.loginUrl,
      version: this.apiVersion,
    });
    this.userInfo = await this.conn.login(username, password);
  }

  /** 2. Username + Password (OAuth2 Resource Owner Password Credential) */
  async _connectUsernamePasswordOAuth({
    username,
    password,
    clientId,
    clientSecret,
    redirectUri,
    loginUrl,
  }) {
    this.conn = new jsforce.Connection({
      oauth2: {
        loginUrl: loginUrl || this.loginUrl,
        clientId,
        clientSecret,
        redirectUri,
      },
      version: this.apiVersion,
    });
    this.userInfo = await this.conn.login(username, password);
  }

  /** 3. Session ID */
  _connectSessionId({ sessionId, instanceUrl }) {
    this.conn = new jsforce.Connection({
      instanceUrl,
      serverUrl: instanceUrl,
      sessionId,
      version: this.apiVersion,
    });
    // No async login step – connection is ready immediately
    this.userInfo = null;
  }

  /** 4. Access Token */
  _connectAccessToken({ accessToken, instanceUrl }) {
    this.conn = new jsforce.Connection({
      instanceUrl,
      accessToken,
      version: this.apiVersion,
    });
    this.userInfo = null;
  }

  /** 5. Access Token with Refresh Token (auto-refresh on 401) */
  _connectAccessTokenWithRefresh({
    accessToken,
    refreshToken,
    instanceUrl,
    clientId,
    clientSecret,
    redirectUri,
    onRefresh,
  }) {
    this.conn = new jsforce.Connection({
      oauth2: {
        clientId,
        clientSecret,
        redirectUri,
      },
      instanceUrl,
      accessToken,
      refreshToken,
      version: this.apiVersion,
    });

    if (typeof onRefresh === 'function') {
      this.conn.on('refresh', (newAccessToken, _res) => {
        onRefresh(newAccessToken);
      });
    }

    this.userInfo = null;
  }

  /** 6. OAuth2 Authorization Code – exchange authorization code for tokens */
  async _connectAuthorizationCode({
    code,
    clientId,
    clientSecret,
    redirectUri,
    loginUrl,
  }) {
    this.conn = new jsforce.Connection({
      oauth2: {
        loginUrl: loginUrl || this.loginUrl,
        clientId,
        clientSecret,
        redirectUri,
      },
      version: this.apiVersion,
    });
    this.userInfo = await this.conn.authorize(code);
  }

  /** 7. JWT Bearer Flow */
  async _connectJwtBearer({ clientId, privateKey, username, audience, loginUrl }) {
    if (!jwt) {
      throw new Error(
        'The "jsonwebtoken" package is required for JWT Bearer authentication. ' +
        'Install it with: npm install jsonwebtoken'
      );
    }

    const aud = audience || loginUrl || this.loginUrl;

    const claim = {
      iss: clientId,
      aud,
      sub: username,
      exp: Math.floor(Date.now() / 1000) + 3 * 60, // 3-minute expiry
    };

    const bearerToken = jwt.sign(claim, privateKey, { algorithm: 'RS256' });

    this.conn = new jsforce.Connection({ version: this.apiVersion });
    this.userInfo = await this.conn.authorize({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: bearerToken,
    });
  }

  /** 8. Client Credentials Flow */
  async _connectClientCredentials({ clientId, clientSecret, instanceUrl, loginUrl }) {
    this.conn = new jsforce.Connection({
      instanceUrl,
      oauth2: {
        clientId,
        clientSecret,
        loginUrl: loginUrl || instanceUrl || this.loginUrl,
      },
      version: this.apiVersion,
    });
    this.userInfo = await this.conn.authorize({ grant_type: 'client_credentials' });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns the underlying jsforce Connection.
   * Throws if not yet connected.
   */
  getConnection() {
    if (!this.conn) {
      throw new Error('Not connected. Call connect() first.');
    }
    return this.conn;
  }

  /**
   * Generate the OAuth2 authorization URL (for the Authorization Code flow).
   * This is a static utility – no active connection required.
   *
   * @param {object} config
   * @param {string} config.clientId
   * @param {string} config.clientSecret
   * @param {string} config.redirectUri
   * @param {string} [config.loginUrl]
   * @param {string} [config.scope='api id web']
   * @param {boolean} [config.includeRefreshToken=true]  Add 'refresh_token' to scope
   * @returns {string} Authorization URL to redirect the user to
   */
  static getAuthorizationUrl({
    clientId,
    clientSecret,
    redirectUri,
    loginUrl = 'https://login.salesforce.com',
    scope = 'api id web',
    includeRefreshToken = true,
  }) {
    const oauth2 = new jsforce.OAuth2({ loginUrl, clientId, clientSecret, redirectUri });
    const fullScope = includeRefreshToken ? `${scope} refresh_token` : scope;
    return oauth2.getAuthorizationUrl({ scope: fullScope });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // METADATA API – DESCRIBE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * List all metadata types available in the org.
   *
   * @param {string} [version] – API version override (e.g. '60.0')
   * @returns {Promise<object>}
   */
  async describeMetadata(version) {
    const conn = this.getConnection();
    return conn.metadata.describe(version || this.apiVersion);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // METADATA API – LIST
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * List summary information for one or more metadata types.
   *
   * @param {Array<{type: string, folder?: string}>} types
   * @param {string} [version] – API version override
   * @returns {Promise<Array<object>>}
   *
   * @example
   * await svc.listMetadata([{ type: 'CustomObject', folder: null }]);
   */
  async listMetadata(types, version) {
    const conn = this.getConnection();
    return conn.metadata.list(types, version || this.apiVersion);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // METADATA API – READ
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Read (retrieve details of) one or more metadata components.
   *
   * @param {string} type       – Metadata type (e.g. 'CustomObject', 'ApexClass')
   * @param {string|string[]} fullNames  – API name(s) of the component(s)
   * @returns {Promise<object|object[]>}
   *
   * @example
   * await svc.readMetadata('CustomObject', ['Account', 'Contact']);
   */
  async readMetadata(type, fullNames) {
    const conn = this.getConnection();
    const names = Array.isArray(fullNames) ? fullNames : [fullNames];
    return conn.metadata.read(type, names);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // METADATA API – CREATE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create one or more metadata components.
   *
   * @param {string} type   – Metadata type
   * @param {object|object[]} metadata – Component definition(s)
   * @returns {Promise<object[]>}  Array of SaveResult objects
   *
   * @example
   * await svc.createMetadata('CustomObject', [{
   *   fullName: 'MyObj__c',
   *   label: 'My Object',
   *   pluralLabel: 'My Objects',
   *   nameField: { type: 'Text', label: 'Name' },
   *   deploymentStatus: 'Deployed',
   *   sharingModel: 'ReadWrite',
   * }]);
   */
  async createMetadata(type, metadata) {
    const conn = this.getConnection();
    const items = Array.isArray(metadata) ? metadata : [metadata];
    return conn.metadata.create(type, items);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // METADATA API – UPDATE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Update one or more existing metadata components.
   *
   * @param {string} type   – Metadata type
   * @param {object|object[]} metadata – Updated component definition(s)
   * @returns {Promise<object[]>}
   *
   * @example
   * await svc.updateMetadata('CustomField', [{
   *   fullName: 'Account.MyField__c',
   *   label: 'Updated Label',
   * }]);
   */
  async updateMetadata(type, metadata) {
    const conn = this.getConnection();
    const items = Array.isArray(metadata) ? metadata : [metadata];
    return conn.metadata.update(type, items);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // METADATA API – UPSERT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Upsert (create if missing, update if exists) metadata components.
   *
   * @param {string} type   – Metadata type
   * @param {object|object[]} metadata – Component definition(s)
   * @returns {Promise<object[]>}  Array of UpsertResult objects (includes `created` flag)
   */
  async upsertMetadata(type, metadata) {
    const conn = this.getConnection();
    const items = Array.isArray(metadata) ? metadata : [metadata];
    return conn.metadata.upsert(type, items);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // METADATA API – RENAME
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Rename a metadata component.
   *
   * @param {string} type       – Metadata type
   * @param {string} oldFullName
   * @param {string} newFullName
   * @returns {Promise<object>}
   */
  async renameMetadata(type, oldFullName, newFullName) {
    const conn = this.getConnection();
    return conn.metadata.rename(type, oldFullName, newFullName);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // METADATA API – DELETE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Delete one or more metadata components.
   *
   * @param {string} type   – Metadata type
   * @param {string|string[]} fullNames – API name(s) of the component(s) to delete
   * @returns {Promise<object[]>}
   *
   * @example
   * await svc.deleteMetadata('CustomObject', ['MyObj1__c', 'MyObj2__c']);
   */
  async deleteMetadata(type, fullNames) {
    const conn = this.getConnection();
    const names = Array.isArray(fullNames) ? fullNames : [fullNames];
    return conn.metadata.delete(type, names);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // METADATA API – CHECK STATUS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check the status of asynchronous metadata operations and wait for completion.
   *
   * @param {string|string[]} asyncResultIds
   * @returns {Promise<object[]>}
   */
  async checkStatus(asyncResultIds) {
    const conn = this.getConnection();
    const ids = Array.isArray(asyncResultIds) ? asyncResultIds : [asyncResultIds];
    return conn.metadata.checkStatus(ids).complete();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // METADATA API – FILE-BASED RETRIEVE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Retrieve metadata as a zipped package (file-based).
   * Returns a readable stream you can pipe to a file or buffer.
   *
   * @param {object} retrieveOptions  – Same structure as Salesforce RetrieveRequest
   *   e.g. { packageNames: ['My Package'] }
   *   or   { unpackaged: { types: [{ name: 'ApexClass', members: ['*'] }], version: '60.0' } }
   * @returns {NodeJS.ReadableStream}
   *
   * @example
   * const fs = require('fs');
   * svc.retrieveMetadata({ packageNames: ['My Package'] })
   *    .stream()
   *    .pipe(fs.createWriteStream('./package.zip'));
   */
  retrieveMetadata(retrieveOptions) {
    const conn = this.getConnection();
    return conn.metadata.retrieve(retrieveOptions);
  }

  /**
   * Retrieve metadata as a zipped package and wait for completion.
   * Returns the AsyncResult after polling.
   *
   * @param {object} retrieveOptions
   * @returns {Promise<object>}
   */
  async retrieveMetadataAndWait(retrieveOptions) {
    const conn = this.getConnection();
    return conn.metadata.retrieve(retrieveOptions).complete();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // METADATA API – FILE-BASED DEPLOY
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Deploy a metadata package (zip stream) to the org and wait for completion.
   *
   * @param {NodeJS.ReadableStream|Buffer} zipInput – Zip file stream or buffer
   * @param {object} [deployOptions]
   * @param {boolean} [deployOptions.checkOnly=false]        – Validation deploy (no commit)
   * @param {boolean} [deployOptions.rollbackOnError=true]   – Rollback on any error
   * @param {boolean} [deployOptions.allowMissingFiles=false]
   * @param {boolean} [deployOptions.autoUpdatePackage=false]
   * @param {boolean} [deployOptions.ignoreWarnings=false]
   * @param {boolean} [deployOptions.performRetrieve=false]
   * @param {boolean} [deployOptions.purgeOnDelete=false]
   * @param {boolean} [deployOptions.singlePackage=false]
   * @param {string[]} [deployOptions.runTests]               – Apex test class names to run
   * @param {string}  [deployOptions.testLevel]               – NoTestRun | RunSpecifiedTests | RunLocalTests | RunAllTestsInOrg
   * @returns {Promise<object>} DeployResult
   *
   * @example
   * const fs = require('fs');
   * const zip = fs.createReadStream('./myPackage.zip');
   * const result = await svc.deployMetadata(zip, {
   *   rollbackOnError: true,
   *   testLevel: 'RunLocalTests',
   * });
   */
  async deployMetadata(zipInput, deployOptions = {}) {
    const conn = this.getConnection();
    const options = { rollbackOnError: true, ...deployOptions };
    return conn.metadata.deploy(zipInput, options).complete();
  }

  /**
   * Validate-only deploy (checkOnly: true). Does not commit changes.
   *
   * @param {NodeJS.ReadableStream|Buffer} zipInput
   * @param {object} [deployOptions]
   * @returns {Promise<object>} DeployResult
   */
  async validateMetadata(zipInput, deployOptions = {}) {
    return this.deployMetadata(zipInput, { ...deployOptions, checkOnly: true });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONVENIENCE WRAPPERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get the current user's identity information.
   * @returns {Promise<object>}
   */
  async getIdentity() {
    return this.getConnection().identity();
  }

  /**
   * Get the current API limit / usage.
   * Makes a lightweight API call to populate limitInfo.
   * @returns {Promise<{limit: number, used: number}>}
   */
  async getApiUsage() {
    const conn = this.getConnection();
    // limitInfo is populated after any API call
    await conn.limits();
    return conn.limitInfo?.apiUsage ?? null;
  }

  /**
   * Describe a specific SObject.
   * @param {string} sobjectType
   * @returns {Promise<object>}
   */
  async describeSObject(sobjectType) {
    return this.getConnection().describe(sobjectType);
  }

  /**
   * List all SObjects in the org (describe global).
   * @returns {Promise<object>}
   */
  async describeGlobal() {
    return this.getConnection().describeGlobal();
  }
}

// Export the class and the AUTH_TYPES constant
module.exports = { SalesforceMetadataService, AUTH_TYPES };
