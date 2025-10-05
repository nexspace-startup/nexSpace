import { create } from 'zustand';
import type { RoomId } from '../rooms/types';

type RoomNotesState = {
  notes: Partial<Record<RoomId, string>>;
  setNote: (roomId: RoomId, value: string) => void;
};

const useRoomNotesStore = create<RoomNotesState>((set) => ({
  notes: {},
  setNote: (roomId, value) => {
    set((state) => ({
      notes: {
        ...state.notes,
        [roomId]: value,
      },
    }));
  },
}));

export const useRoomNote = (roomId: RoomId | null) => {
  const note = useRoomNotesStore((state) => (roomId ? state.notes[roomId] ?? '' : ''));
  const setNote = useRoomNotesStore((state) => state.setNote);

  const updateNote = (value: string) => {
    if (!roomId) return;
    setNote(roomId, value);
  };

  return { note, setNote: updateNote };
};

export const clearRoomNotes = (roomId: RoomId) => {
  useRoomNotesStore.setState((state) => {
    const next = { ...state.notes };
    delete next[roomId];
    return { notes: next };
  });
};
