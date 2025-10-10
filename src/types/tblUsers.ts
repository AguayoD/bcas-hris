export type tblUsersTypes = {
  userId?: number | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  newPassword: string | null;
  roleId: number | null;
  employeeId: number | null;
  isActive?: boolean | null;
};

export type UserListItem = {
  userId: number;
  employeeId: number | null;
  roleId: number | null;
  userName: string | null;
  isActive: boolean | null;
  firstName?: string | null;
  lastName?: string | null;
};

export type Role = {
  roleId: number;
  roleName: string;
};