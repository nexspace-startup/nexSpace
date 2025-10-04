export const DesignationOptions = ["OWNER", "ADMIN", "MEMBER"] as const;
export type Designation = (typeof DesignationOptions)[number];

export const WorkspaceRoleConstant = {
    OWNER: "OWNER",
    ADMIN: "ADMIN",
    MEMBER: "MEMBER"
} as const
export type WorkSpaceRole = (typeof WorkspaceRoleConstant)[keyof typeof WorkspaceRoleConstant];

export const PresenceStatusConstants = {
    IN_MEETING: "IN_MEETING",
    AVAILABLE: "AVAILABLE",
    DO_NOT_DISTURB: "DO_NOT_DISTURB",
    AWAY: "AWAY",
    BUSY: "BUSY"
} as const 
export type PresenceStatus = (typeof PresenceStatusConstants)[keyof typeof PresenceStatusConstants];