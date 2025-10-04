import { ENDPOINTS } from "../constants/endpoints"
import { api } from "./httpService"
import type { ApiEnvelope } from "../types/api"
import { isApiSuccess } from "../types/api"

export interface InvitationResponse {
  invitationUrl: string
  emailSent: boolean
}

export interface AcceptInvitationResponse {
  accepted: boolean
  alreadyMember: boolean
  workspaceUid: string
  workspaceName: string
}

export interface InviteUserRequest {
  email: string
  workspaceUid: string | null
}

export async function inviteUser(request: InviteUserRequest): Promise<InvitationResponse | null> {
  try {
    const { data } = await api.post<ApiEnvelope<InvitationResponse>>(ENDPOINTS.INVITEUSER, request)
    return isApiSuccess(data) ? data.data : null
  } catch {
    return null
  }
}

export async function acceptInvitation(token: string): Promise<AcceptInvitationResponse | null> {
  try {
    const { data } = await api.post<ApiEnvelope<AcceptInvitationResponse>>(ENDPOINTS.ACCEPTINVITATION(token))
    return isApiSuccess(data) ? data.data : null
  } catch {
    return null
  }
}
