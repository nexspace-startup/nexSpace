import React from 'react';
import type { RoomId } from '../rooms/types';

type Props = {
  roomId: RoomId;
  value: string;
  onChange: (value: string) => void;
};

const labelByRoom: Partial<Record<RoomId, string>> = {
  conference: 'Conference Whiteboard',
  'focus-booths': 'Focus Notes',
};

const RoomWhiteboard: React.FC<Props> = ({ roomId, value, onChange }) => {
  const label = labelByRoom[roomId] ?? 'Shared Notes';
  return (
    <div
      className="absolute right-4 bottom-24 w-64 sm:w-72 rounded-xl border shadow-lg backdrop-blur"
      style={{
        background: 'var(--surface-1)',
        borderColor: 'var(--panel-border)',
        color: 'var(--text-1)',
        boxShadow: '0 18px 42px rgba(0,0,0,0.35)'
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--panel-border)' }}
      >
        <div className="font-semibold text-sm">{label}</div>
        <span className="text-[11px] text-[var(--text-3)]">Visible to everyone here</span>
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Capture key points, tasks, or follow-ups..."
        className="w-full resize-none border-0 bg-transparent px-4 py-3 text-sm leading-5 focus:outline-none focus:ring-0"
        rows={6}
      />
    </div>
  );
};

export default RoomWhiteboard;
