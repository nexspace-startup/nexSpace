export type AccountData = {
  firstName: string;
  lastName: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  company?: string;
};

export type WorkspaceData = {
  workspaceName: string;
  teamSize: "1-5" | "6-10" | "11-25" | "26-50" | "51-100" | "100+";
};

export type InviteData = { invites: string[] };

export type OnboardingPayload = AccountData & WorkspaceData | InviteData;
