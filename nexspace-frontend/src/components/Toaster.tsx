import React, { useEffect } from "react";
import { useToastStore, type ToastItem } from "../stores/toastStore";
import successIcon from "../assets/toast_success.svg";
import errorIcon from "../assets/toast_error.svg";
import warningIcon from "../assets/toast_warning.svg";

function Icon({ variant }: { variant: ToastItem["variant"] }) {
  const src = variant === "success" ? successIcon : variant === "error" ? errorIcon : warningIcon;
  const alt = variant === "success" ? "Success" : variant === "error" ? "Error" : "Warning";
  return <img src={src} alt={alt} className="w-5 h-5" />;
}

function ToastRow({ t }: { t: ToastItem }) {
  const remove = useToastStore((s) => s.remove);
  useEffect(() => {
    const id = setTimeout(() => remove(t.id), t.duration ?? 4500);
    return () => clearTimeout(id);
  }, [t.id, t.duration, remove]);

  const styles =
    t.variant === "success"
      ? { bg: "bg-[rgba(72,255,144,0.2)]", text: "text-[#48FFA4]" }
      : t.variant === "error"
        ? { bg: "bg-[rgba(255,96,96,0.2)]", text: "text-[#FF6060]" }
        : { bg: "bg-[rgba(255,158,88,0.2)]", text: "text-[#FF9E58]" };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-sm border border-[#26272B] ${styles.bg}`}>
      <Icon variant={t.variant} />
      <p className={`text-sm font-medium ${styles.text}`}>{t.message}</p>
      <button
        className="ml-auto w-8 h-8 grid place-items-center text-white/80 hover:text-white"
        aria-label="Dismiss"
        onClick={() => remove(t.id)}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
          <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

const Toaster: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="fixed z-[1000] right-6 top-6 flex flex-col gap-3 w-auto">
      {toasts.map((t) => (
        <ToastRow key={t.id} t={t} />
      ))}
    </div>
  );
};

export default Toaster;

