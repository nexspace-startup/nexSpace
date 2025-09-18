import React, { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../stores/userStore";
import settingsIcon from "../assets/settings_icon.svg";
import logoutIcon from "../assets/logout_icon.svg";
import helpIcon from "../assets/help_icon.svg";
import { initialsFrom } from "../utils/util";

export type ProfileFlyoutProps = {
  open: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  className?: string; // for absolute positioning from parent
  style?: React.CSSProperties;
};

const ProfileFlyout: React.FC<ProfileFlyoutProps> = ({
  open,
  onClose,
  anchorRef,
  className,
  style,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const logout = useUserStore((s) => s.logout);

  // outside click + Escape to close
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (ref.current?.contains(t)) return;
      if (anchorRef?.current && anchorRef.current.contains(t as any)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("touchstart", onDocDown, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("touchstart", onDocDown as any);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  const name = useMemo(() => {
    const n = user?.name ?? [user?.firstName, user?.lastName].filter(Boolean).join(" ");
    return n || "User";
  }, [user]);
  const email = user?.email ?? "";
  const avatarUrl = (user as any)?.avatar ?? undefined;

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={[
        "absolute left-[14px] bottom-[78px] w-[355px] h-[292px] isolate z-50",
        className || "",
      ].join(" ")}
      style={{ isolation: "isolate", ...(style || {}) }}
      role="dialog"
      aria-label="Profile menu"
    >
      <div className="w-full h-full bg-[#18181B] border border-[#26272B] shadow-[1px_1px_15px_rgba(0,0,0,0.2)] rounded-[20px] p-5 flex flex-col items-center gap-3">
        {/* Header user card */}
        <div className="w-[331px] flex flex-col items-center gap-8">
          <div className="w-[315px] h-[68px] rounded-[16px] bg-[rgba(32,32,36,0.5)] p-4 flex items-center gap-2">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full overflow-hidden grid place-items-center bg-[rgba(88,39,218,0.25)]">
              {avatarUrl ? (
                <img src={avatarUrl} alt={name || "Avatar"} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[12px] font-medium text-white/90">{initialsFrom(name)}</span>
              )}
            </div>
            <div className="flex flex-col items-start leading-none">
              <div className="text-white text-[14px] font-manrope font-small">{name}</div>
              <div className="text-[#80889B] py-1 text-[12px] font-manrope">{email || "—"}</div>
            </div>
          </div>

          {/* Actions */}
          <div className="w-[331px] flex flex-col items-center gap-3">
            {/* Settings */}
            <button
              className="w-full h-10 rounded-[12px] px-2 flex items-center gap-2 hover:bg-white/5 text-[#80889B]"
              onClick={() => {
                onClose();
                navigate('/settings');
              }}
            >
              <img src={settingsIcon} alt="Settings" className="w-5 h-5 opacity-80" />
              <span className="text-[14px] font-medium">Settings</span>
            </button>

            {/* Divider */}
            <div className="w-[315px] border-t border-[#26272B]" />

            {/* Help */}
            <button
              className="w-full h-10 rounded-[12px] px-2 flex items-center gap-2 hover:bg-white/5 text-[#80889B]"
              onClick={() => {
                onClose();
                navigate('/help');
              }}
            >
              <span className="w-5 h-5 text-[#80889B]">
                <img src={helpIcon} alt="Help" className="w-5 h-5" />
              </span>
              <span className="text-[14px] font-medium">Help</span>
            </button>

            {/* Logout */}
            <button
              className="w-full h-10 rounded-[12px] px-2 flex items-center gap-2 bg-[#202024] hover:bg-[#232327]"
              onClick={async () => {
                onClose();
                await logout();
                navigate('/signin', { replace: true });
              }}
            >
              <img src={logoutIcon} alt="Log Out" className="w-5 h-5" />
              <span className="text-[14px] font-semibold text-[#ED5C5B]">Log Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileFlyout;
