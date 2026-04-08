// API Configuration and Generic Request Handler
// ===========================================

// Base Configuration
// ------------------
export const API_CONFIG = {
	BASE_URL: (import.meta as any).env.VITE_API_URL || 'http://localhost:3000',
	API_VERSION: '/api/v1',
	TIMEOUT: 120000, // 120 seconds
} as const;

// Get full API URL
export const getApiUrl = (endpoint: string): string => {
	const baseUrl = API_CONFIG.BASE_URL + API_CONFIG.API_VERSION;
	return endpoint.startsWith('/') ? baseUrl + endpoint : `${baseUrl}/${endpoint}`;
};

// Authentication Utilities
// ------------------------
export const getAuthToken = (): string | null => {
	return localStorage.getItem('token');
};

export const getAuthUser = () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
};

export const isAuthenticated = () => {
	const token = getAuthToken();
	return !!token;
};

export const logout = () => {
	localStorage.removeItem('token');
	localStorage.removeItem('user');
	window.location.href = '/login';
};

export const setAuthData = (token: string, user: any) => {
	localStorage.setItem('token', token);
	localStorage.setItem('user', JSON.stringify(user));
};

export const getAuthHeaders = (): HeadersInit => {
	const token = getAuthToken();
	const headers: HeadersInit = {
		'Content-Type': 'application/json',
	};

	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}

	return headers;
};

export const getFileUploadHeaders = (): HeadersInit => {
	const token = getAuthToken();
	const headers: HeadersInit = {};

	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}

	return headers;
};

// API Routes Configuration
// ------------------------
export const API_ROUTES = {
	// Authentication & User Management
	AUTH: {
		LOGIN: '/user/login',
		SIGNUP: '/user/signup',
		LOGOUT: '/user/logout',
		PROFILE: '/user/profile',
	},

	// Salesforce
	SF: {
		CONNECT:            '/sf/connect',
		ORGS:               '/sf/orgs',
		DISCONNECT_ORG:     (orgId: string) => `/sf/orgs/${orgId}/disconnect`,
		DELETE_ORG:         (orgId: string) => `/sf/orgs/${orgId}`,
		RESOURCES:          '/sf/get/resources',
		CONVERSATION:       '/sf/conversation',
		SESSIONS_BY_SF_ORG: (sfOrgId: string) => `/sf/sessions/sf/${sfOrgId}`,
		SESSIONS_BY_ORG:    (orgId: string) => `/sf/sessions/${orgId}`,
		MESSAGES:           (sessionId: string) => `/sf/messages/${sessionId}`,
		DELETE_SESSION:     (sessionId: string) => `/sf/sessions/${sessionId}`,
		LOGS:               '/sf/logs',
		LOGS_BY_SESSION:    (sessionId: string) => `/sf/logs/${sessionId}`,
	},
} as const;

// Request/Response Types
// ---------------------
export interface ApiResponse<T = any> {
	success: boolean;
	data: T;
	message?: string;
	errors?: any;
}

export interface PaginatedResponse<T = any> {
	success: boolean;
	data: T[];
	pagination?: {
		page: number;
		limit: number;
		total: number;
		pages: number;
		hasNext: boolean;
		hasPrev: boolean;
	};
}

// export interface ApiError {
// 	message: string;
// 	status: number;
// 	code?: string;
// }

export interface QueryParams {
	[key: string]: string | number | boolean | undefined;
}

// Generic API Request Function
// ----------------------------
export class ApiClient {
	private static instance: ApiClient;

	public static getInstance(): ApiClient {
		if (!ApiClient.instance) {
			ApiClient.instance = new ApiClient();
		}
		return ApiClient.instance;
	}

	private async request<T = any>(
		endpoint: string,
		options: RequestInit = {}
	): Promise<ApiResponse<T>> {
		const url = getApiUrl(endpoint);

		const config: RequestInit = {
			...options,
			headers: {
				...getAuthHeaders(),
				...options.headers,
			},
		};

		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

			const response = await fetch(url, {
				...config,
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			const contentType = response.headers.get('content-type');
			let data;

			if (contentType && contentType.includes('application/json')) {
				data = await response.json();
			} else {
				data = await response.text();
			}

			if (!response.ok) {
				throw new ApiError(
					data?.message || `HTTP ${response.status}: ${response.statusText}`,
					response.status,
					data?.errors || []
				);
			}

			return data;
		} catch (error) {
			if (error instanceof ApiError) {
				throw error;
			}

			if (error instanceof Error) {
				if (error.name === 'AbortError') {
					throw new ApiError('Request timeout', 0);
				}
				throw new ApiError(error.message, 0);
			}

			throw new ApiError('Unknown error occurred', 0);
		}
	}

	// HTTP Methods
	async get<T = any>(endpoint: string, params?: QueryParams): Promise<ApiResponse<T>> {
		const url = params ? `${endpoint}?${new URLSearchParams(
			Object.entries(params)
				.filter(([, value]) => value !== undefined)
				.map(([key, value]) => [key, String(value)])
		)}` : endpoint;

		return this.request<T>(url, { method: 'GET' });
	}

	async post<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
		return this.request<T>(endpoint, {
			method: 'POST',
			body: data ? JSON.stringify(data) : undefined,
		});
	}

	async put<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
		return this.request<T>(endpoint, {
			method: 'PUT',
			body: data ? JSON.stringify(data) : undefined,
		});
	}

	async patch<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
		return this.request<T>(endpoint, {
			method: 'PATCH',
			body: data ? JSON.stringify(data) : undefined,
		});
	}

	async delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
		return this.request<T>(endpoint, { method: 'DELETE' });
	}

	// File Upload Method
	async uploadFile<T = any>(endpoint: string, file: File, additionalData?: Record<string, string>): Promise<ApiResponse<T>> {
		const formData = new FormData();
		formData.append('file', file);

		if (additionalData) {
			Object.entries(additionalData).forEach(([key, value]) => {
				formData.append(key, value);
			});
		}

		const url = getApiUrl(endpoint);

		const response = await fetch(url, {
			method: 'POST',
			headers: getFileUploadHeaders(),
			body: formData,
		});

		const contentType = response.headers.get('content-type');
		let data;

		if (contentType && contentType.includes('application/json')) {
			data = await response.json();
		} else {
			data = await response.text();
		}

		if (!response.ok) {
			throw new ApiError(
				data?.message || `HTTP ${response.status}: ${response.statusText}`,
				response.status,
				data?.errors || []
			);
		}

		return data;
	}
}

// Export singleton instance
export const apiClient = ApiClient.getInstance();

// Custom Error Class
export class ApiError extends Error {

	errors: any[] = [];
	statusCode = 0;
	
	constructor( message: string, statusCode?: number, errors?: any[]) {
		super(message);
		this.name = 'API_ERROR';
		this.errors = errors || [];
		this.statusCode = statusCode || 0;
	}
}