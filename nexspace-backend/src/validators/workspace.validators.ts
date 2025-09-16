import z from 'zod';

export const MeetingJoinParams = z.object({
  workspaceUid: z.string().min(1)
});

export type MeetingJoinParamsType = z.infer<typeof MeetingJoinParams>;

export const CreateWorkspaceBody = z.object({
  name: z.string().trim().min(1, 'Workspace name is required').max(120, 'Max length is 120 characters'),
});

export type CreateWorkspaceBodyType = z.infer<typeof CreateWorkspaceBody>;

