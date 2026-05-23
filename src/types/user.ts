export type UserRole = "student" | "admin";

export interface AppUser {
  uid: string;
  teamName: string;
  teamCode: string;
  role: UserRole;
  createdAt: number; // Unix ms — serializes cleanly to/from JSON
}
