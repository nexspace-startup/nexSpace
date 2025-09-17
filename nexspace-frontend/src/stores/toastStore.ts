import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type ToastVariant = "success" | "error" | "warning";

export type ToastItem = {
  id: string;
  variant: ToastVariant;
  message: string;
  duration?: number; // ms
};

type ToastState = {
  toasts: ToastItem[];
  add: (t: Omit<ToastItem, "id"> & { id?: string }) => string;
  remove: (id: string) => void;
  clear: () => void;
};

export const useToastStore = create<ToastState>()(
  devtools((set) => ({
    toasts: [],
    add: (t) => {
      const id = t.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const item: ToastItem = {
        id,
        variant: t.variant,
        message: t.message,
        duration: t.duration ?? 4500,
      };
      set((s) => ({ toasts: [...s.toasts, item] }));
      return id;
    },
    remove: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
    clear: () => set({ toasts: [] }),
  }))
);

export const toast = {
  success(message: string, duration?: number) {
    return useToastStore.getState().add({ variant: "success", message, duration });
  },
  error(message: string, duration?: number) {
    return useToastStore.getState().add({ variant: "error", message, duration });
  },
  warning(message: string, duration?: number) {
    return useToastStore.getState().add({ variant: "warning", message, duration });
  },
  dismiss(id: string) {
    useToastStore.getState().remove(id);
  },
  clear() {
    useToastStore.getState().clear();
  },
};
