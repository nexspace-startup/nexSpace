export const DesignationOptions = ["OWNER", "ADMIN", "MEMBER"] as const;
export type Designation = (typeof DesignationOptions)[number];