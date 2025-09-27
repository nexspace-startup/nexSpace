export const DesignationOptions = ["OWNER", "ADMIN", "MEMBER"] as const;
export type Designation = (typeof DesignationOptions)[number];
export const WorkspaceRoleConstant = {
    OWNER: "OWNER",
    ADMIN: "ADMIN",
    MEMBER: "MEMBER"
} as const
export type WorkSpaceRole = (typeof WorkspaceRoleConstant)[keyof typeof WorkspaceRoleConstant];