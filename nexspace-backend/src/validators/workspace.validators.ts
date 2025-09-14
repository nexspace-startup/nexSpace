import z from 'zod';

export const MeetingJoinParams = z.object({
  workspaceUid: z.string().min(1)
});

export type MeetingJoinParamsType = z.infer<typeof MeetingJoinParams>;

