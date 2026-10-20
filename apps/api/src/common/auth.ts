import { SetMetadata } from "@nestjs/common";
import type { Permission } from "@vmp/shared";

export const IS_PUBLIC = "isPublic";
export const PERMISSIONS_KEY = "permissions";

export const Public = () => SetMetadata(IS_PUBLIC, true);
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);

export type AuthContext = {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  vendorId: string | null;
  roles: string[];
  permissions: string[];
  sessionId: string;
  csrfHash: string;
  mustChangePassword: boolean;
};
