import React from 'react';
import type { ChatMessage } from '../../stores/meetingStore';

interface MessageItemProps {
  message: ChatMessage;
  isMine: boolean;
  avatarUrl?: string;
  initialsFrom: (name: string) => string;
  colorForParticipant: (sid: string, name: string) => string;
  isLight: (color: string) => boolean;
  onRetry?: (messageId: string) => void;
  showAvatar?: boolean;
  showSenderName?: boolean;
  showTimestamp?: boolean;
  className?: string;
  timestampFormat?: Intl.DateTimeFormatOptions;
}

const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isMine,
  avatarUrl,
  initialsFrom,
  colorForParticipant,
  isLight,
  onRetry,
  showAvatar = true,
  showSenderName = true,
  showTimestamp = true,
  className = '',
  timestampFormat = {
    hour: "numeric",
    minute: "2-digit",
  },
}) => {
  const status = message.status ?? 'success';
  const bubbleBase = isMine
    ? 'bg-[rgba(66,133,244,0.13)] text-[#FFFFFF]'
    : 'bg-[rgba(128,136,155,0.13)] text-[#FFFFFF]';
  const bubbleStatus = status === 'pending' ? 'opacity-60' : '';
  const nameInitials = initialsFrom(message.senderName);
  const accent = colorForParticipant(message.senderSid, message.senderName);
  const textOnAccent = isLight(accent) ? '#0F1216' : '#FFFFFF';

  return (
    <div className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'} ${className}`}>
      {!isMine && showAvatar && (
        <div className="w-6 h-6 rounded-full overflow-hidden grid self-start place-items-center flex-shrink-0" style={{ backgroundColor: accent }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={message.senderName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10px] font-semibold" style={{ color: textOnAccent }}>{nameInitials}</span>
          )}
        </div>
      )}

      <div className={`max-w-[80%] ${isMine ? 'flex flex-col items-end' : ''}`}>
        {!isMine && showSenderName && (
          <div className="text-[11px] mb-0.5 px-1" style={{ color: accent }}>{message.senderName}</div>
        )}

        <div className={`relative group ${isMine ? 'flex flex-col items-end' : ''}`}>
          <div
            className={`inline-block max-w-full ${bubbleBase} ${bubbleStatus} rounded-lg px-3 py-1.5 whitespace-pre-wrap break-words text-left`}
            style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' as any }}
            title={status === 'pending' ? 'Sending…' : status === 'failed' ? 'Failed to send' : ''}
          >
            <div className="flex flex-col">
              <span>{message.text}</span>
              {showTimestamp && (
                <div className={`mt-1 text-[10px] text-[#9AA3B2] select-none ${isMine ? 'text-right' : 'text-left'}`}>
                  {new Date(message.ts).toLocaleTimeString([], timestampFormat)}
                </div>
              )}
            </div>
          </div>

          {/* Status indicators */}
          {isMine && status === 'pending' && (
            <div className="text-[11px] text-[#80889B] mt-0.5 px-1">Sending…</div>
          )}

          {isMine && status === 'failed' && onRetry && (
            <div className="flex items-center gap-2 mt-0.5 px-1">
              <span className="text-red-500 font-bold text-sm" aria-label="Message failed" title="Message failed to send">!</span>
              <button
                type="button"
                className="text-xs text-[#C2C8D1] hover:text-white underline"
                onClick={() => onRetry(message.id)}
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>

      {isMine && showAvatar && (
        <div className="w-6 h-6 rounded-full overflow-hidden grid self-start place-items-center flex-shrink-0" style={{ backgroundColor: accent }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10px] font-semibold" style={{ color: textOnAccent }}>{nameInitials}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(MessageItem);
