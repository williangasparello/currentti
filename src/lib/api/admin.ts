import { apiList, apiPost, apiPatch, apiDelete } from "./client";

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  status: "pending" | "approved" | "blocked";
  roles: string[];
  is_placeholder: boolean;
  created_at: string;
}

export const listUsers = () => apiList<AdminUser>("/admin/users");

export const createUser = (body: {
  email: string;
  password: string;
  fullName: string;
  admin: boolean;
}) => apiPost<AdminUser>("/admin/users", body);

export const updateUser = (
  id: string,
  body: { status?: string; admin?: boolean; full_name?: string },
) => apiPatch<AdminUser>(`/admin/users/${id}`, body);

export const resetUserPassword = (id: string, password: string) =>
  apiPost(`/admin/users/${id}/password`, { password });

export const deleteUser = (id: string) => apiDelete(`/admin/users/${id}`);
