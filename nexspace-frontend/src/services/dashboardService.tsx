import { ENDPOINTS } from "../constants/endpoints";
import { api } from "./httpService";

interface InvitationResponse {
    invitationUrl: string;
    emailSent: boolean;
}

interface AcceptInvitationResponse {
    accepted: boolean,
    alreadyMember: boolean,
    workspaceId: string,
    workspaceName: string,
}
export async function inviteUser(request: any): Promise<InvitationResponse | null> {
    try {
        const { data } = await api.post(ENDPOINTS.INVITEUSER, request);
        return data?.data ?? null;
    } catch {
        return null;
    }
}

export async function acceptInvitation(token: string): Promise<AcceptInvitationResponse | null> {
    try {
        const { data } = await api.post(ENDPOINTS.ACCEPTINVITATION(token));
        return data?.data ?? null;
    } catch {
        return null;
    }
}

