
export interface LoginData {
	email: string;
	password: string;
}

export interface SignupData {
	name: string;
	email: string;
	password: string;
}

export interface User {
	id: string;
	name: string;
	email: string;
	organization?: string;
	created_at?: string;
}

// ── Org ──────────────────────────────────────────────────────────────────────

export type OrgAuthType =
	| 'usernamePassword'
	| 'sessionId'
	| 'clientCredentials';

export interface Org {
	id: string;
	user_id: string;
	name: string;
	instance_url: string;
	environment: 'Production' | 'Sandbox';
	status: 'connected' | 'error' | 'disconnected';
	sf_org_id: string | null;
	created_at?: string | null;
	connected_at: string | null;
	auth_type?: OrgAuthType;
	/** true if a live jsforce connection exists in the server connectionMap */
	isLive?: boolean;
}

export interface ConnectOrgData {
	name: string;
	authType: OrgAuthType;
	authConfig: Record<string, any>;
	environment: 'Production' | 'Sandbox';
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatSession {
	id: string;
	org_id: string;
	sf_org_id: string;
	title: string;
	created_at: string;
	updated_at: string;
	messageCount?: number;
}

export interface ChatMessage {
	id: string;
	session_id: string;
	role: 'user' | 'assistant';
	content: string;
	created_at: string;
}

// ── Action Logs ───────────────────────────────────────────────────────────────

export interface ActionLog {
	id: string;
	session_id: string;
	tool_name: string;
	params_json: string | null;
	status: 'pending' | 'success' | 'error';
	result_json: string | null;
	error: string | null;
	duration_ms: number | null;
	created_at: string;
}