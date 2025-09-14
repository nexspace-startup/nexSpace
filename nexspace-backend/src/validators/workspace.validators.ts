import z from 'zod';

export const MeetingJoinParams = z.object({
  workspaceUid: z.string().regex(/^\d+$/, 'workspaceUid must be numeric')
});

export type MeetingJoinParamsType = z.infer<typeof MeetingJoinParams>;

