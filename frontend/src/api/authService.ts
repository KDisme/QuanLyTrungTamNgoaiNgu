import http from "./axios";

export type LoginPayload = {
	email: string;
	password: string;
};

export type RegisterPayload = {
	name: string;
	email: string;
	password: string;
};

export type ChangePasswordPayload = {
	oldPassword: string;
	newPassword: string;
};

// Auth endpoints are mounted under `/api/auth` in the backend.
export const apiLogin = (data: LoginPayload) => http.post("/auth/login", data);
export const apiRegister = (data: RegisterPayload) => http.post("/auth/register", data);
export const apiChangePassword = (data: ChangePasswordPayload) => http.post("/auth/change-password", data);
