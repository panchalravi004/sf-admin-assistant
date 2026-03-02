import { API_ROUTES, apiClient, setAuthData } from "./apiCore";
import { LoginData, SignupData, User, Org, ConnectOrgData, ChatSession, ChatMessage, ActionLog } from "./objects";

// ── Auth ─────────────────────────────────────────────────────────────────────

export class AuthService {
	static async login(data: LoginData): Promise<{ user: User; token: string }> {
		const res = await apiClient.post<{ user: User; token: string }>(API_ROUTES.AUTH.LOGIN, data);
		// res is the full JSON body: { success, data: { user, token } }
		setAuthData(res.data.token, res.data.user);
		return res.data;
	}

	static async signup(data: SignupData): Promise<{ user: User; token: string }> {
		const res = await apiClient.post<{ user: User; token: string }>(API_ROUTES.AUTH.SIGNUP, data);
		setAuthData(res.data.token, res.data.user);
		return res.data;
	}

	static async getProfile(): Promise<User> {
		const res = await apiClient.get<User>(API_ROUTES.AUTH.PROFILE);
		// backend: { success, data: user }
		return res.data as unknown as User;
	}

	static async updateProfile(data: { name?: string; organization?: string }): Promise<User> {
		const res = await apiClient.patch<User>(API_ROUTES.AUTH.PROFILE, data);
		return res.data as unknown as User;
	}
}

// ── Org ──────────────────────────────────────────────────────────────────────

export class OrgService {
	static async connectOrg(data: ConnectOrgData): Promise<Org> {
		const res = await apiClient.post<{ org: Org }>(API_ROUTES.SF.CONNECT, data);
		// backend: { success, data: { org, sfInfo } }
		return res.data.org;
	}

	static async getOrgs(): Promise<Org[]> {
		const res = await apiClient.get<Org[]>(API_ROUTES.SF.ORGS);
		// backend: { success, data: [ ...orgs ] }
		return (res.data as unknown as Org[]) || [];
	}

	static async disconnectOrg(orgId: string): Promise<void> {
		await apiClient.post(API_ROUTES.SF.DISCONNECT_ORG(orgId), {});
	}

	static async getResources(sfOrgId: string, metadataType: string): Promise<any[]> {
		const res = await apiClient.get<any[]>(API_ROUTES.SF.RESOURCES, { sfOrgId, metadataType } as any);
		return (res.data as unknown as any[]) || [];
	}
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export class ChatService {
	static async sendMessage(payload: {
		sfOrgId: string;
		sessionId?: string;
		input_text: string;
	}): Promise<{ sessionId: string; reply: string }> {
		const res = await apiClient.post<{ response: string; sessionId: string }>(
			API_ROUTES.SF.CONVERSATION,
			payload
		);
		// backend: { success, data: { response, sessionId, usage, turns } }
		return { sessionId: res.data.sessionId, reply: res.data.response };
	}

	static async getSessions(sfOrgId: string): Promise<ChatSession[]> {
		const res = await apiClient.get<ChatSession[]>(
			API_ROUTES.SF.SESSIONS_BY_SF_ORG(sfOrgId)
		);
		// backend: { success, data: [ ...sessions ] }
		return (res.data as unknown as ChatSession[]) || [];
	}

	static async getMessages(sessionId: string): Promise<ChatMessage[]> {
		const res = await apiClient.get<ChatMessage[]>(API_ROUTES.SF.MESSAGES(sessionId));
		// backend: { success, data: [ ...messages ] }
		return (res.data as unknown as ChatMessage[]) || [];
	}

	static async deleteSession(sessionId: string): Promise<void> {
		await apiClient.delete(API_ROUTES.SF.DELETE_SESSION(sessionId));
	}

	static async getSessionLogs(sessionId: string): Promise<ActionLog[]> {
		const res = await apiClient.get<ActionLog[]>(API_ROUTES.SF.LOGS_BY_SESSION(sessionId));
		// backend: { success, data: [ ...logs ] }
		return (res.data as unknown as ActionLog[]) || [];
	}

	static async getAllActionLogs(): Promise<ActionLog[]> {
		const res = await apiClient.get<ActionLog[]>(API_ROUTES.SF.LOGS);
		// backend: { success, data: [ ...logs ] }
		return (res.data as unknown as ActionLog[]) || [];
	}
}

