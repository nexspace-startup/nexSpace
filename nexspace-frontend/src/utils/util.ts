import type { ChatMessage } from "../stores/meetingStore";

export function initialsFrom(name?: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "U";
  return parts.map(p => p[0]?.toUpperCase() ?? "").join("") || "U";
}

export function fmtHMS(ms: number) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(sec / 3600).toString().padStart(2, "0");
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${h} : ${m} : ${s}`;
}

// Helper function to get day label
export const getDayLabel = (timestamp: number): string => {
  const messageDate = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Reset time to start of day for comparison
  const messageDateStart = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

  if (messageDateStart.getTime() === todayStart.getTime()) {
    return 'Today';
  } else if (messageDateStart.getTime() === yesterdayStart.getTime()) {
    return 'Yesterday';
  } else {
    return messageDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
};

// Helper function to check if we need a day separator
export const shouldShowDaySeparator = (currentMessage: ChatMessage, previousMessage?: ChatMessage): boolean => {
  if (!previousMessage) return true;

  const currentDate = new Date(currentMessage.ts);
  const previousDate = new Date(previousMessage.ts);

  // Check if messages are on different days
  return currentDate.toDateString() !== previousDate.toDateString();
};


export const isMessageMine = ({ message, myLivekitId, myUserId }: any): boolean => {
  return message.isLocal ||
    (myLivekitId && String(message.senderSid) === String(myLivekitId)) ||
    (myUserId && String(message.senderSid) === String(myUserId));
};