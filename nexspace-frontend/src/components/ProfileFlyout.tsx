import React, { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../stores/userStore";
import settingsIcon from "../assets/settings_icon.svg";
import { initialsFrom } from "../utils/util";
import { useMeetingStore } from "../stores/meetingStore";

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
  const getAvatarFor = useMeetingStore((s) => s.getAvatarFor);
  const localSid = useMeetingStore((s) => (s.room as any)?.localParticipant?.sid ?? (s.room as any)?.localParticipant?.identity);

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
  // Prefer in-room avatar if available (from LiveKit metadata), fallback to userStore avatar
  const avatarUrl = useMemo(() => {
    const fromMeeting = localSid ? getAvatarFor(localSid as string) : undefined;
    console.log(fromMeeting, user?.avatar);
    return fromMeeting || (user as any)?.avatar || undefined;
  }, [getAvatarFor, localSid, user]);

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
              className="group w-full h-10 rounded-[12px] px-2 flex items-center gap-2 hover:bg-white/5 text-[#80889B]"
              onClick={() => {
                onClose();
                navigate('/settings');
              }}
            >
              <img src={settingsIcon} alt="Settings" className="w-4 h-4" />
              <span className="text-[14px] font-medium group-hover:text-[#FFFFFF]">Settings</span>
            </button>

            {/* Divider */}
            <div className="w-[315px] border-t border-[#26272B]" />

            {/* Help */}
            <button
              className="group w-full h-10 rounded-[12px] px-2 flex items-center gap-2 hover:bg-white/5 text-[#80889B]"
              onClick={() => {
                onClose();
                navigate('/help');
              }}
            >
              <svg width="16" height="15" viewBox="0 0 16 15" className="text-[#80889B] group-hover:text-[#FFFFFF]" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.9625 12C8.225 12 8.447 11.9092 8.6285 11.7277C8.81 11.5462 8.9005 11.3245 8.9 11.0625C8.8995 10.8005 8.809 10.5785 8.6285 10.3965C8.448 10.2145 8.226 10.124 7.9625 10.125C7.699 10.126 7.47725 10.2168 7.29725 10.3973C7.11725 10.5778 7.0265 10.7995 7.025 11.0625C7.0235 11.3255 7.11425 11.5475 7.29725 11.7285C7.48025 11.9095 7.702 12 7.9625 12ZM8 15C6.9625 15 5.9875 14.803 5.075 14.409C4.1625 14.015 3.36875 13.4808 2.69375 12.8063C2.01875 12.1318 1.4845 11.338 1.091 10.425C0.697501 9.512 0.500501 8.537 0.500001 7.5C0.499501 6.463 0.696501 5.488 1.091 4.575C1.4855 3.662 2.01975 2.86825 2.69375 2.19375C3.36775 1.51925 4.1615 0.985 5.075 0.591C5.9885 0.197 6.9635 0 8 0C9.0365 0 10.0115 0.197 10.925 0.591C11.8385 0.985 12.6323 1.51925 13.3063 2.19375C13.9803 2.86825 14.5148 3.662 14.9098 4.575C15.3048 5.488 15.5015 6.463 15.5 7.5C15.4985 8.537 15.3015 9.512 14.909 10.425C14.5165 11.338 13.9823 12.1318 13.3063 12.8063C12.6303 13.4808 11.8365 14.0152 10.925 14.4097C10.0135 14.8042 9.0385 15.001 8 15ZM8 13.5C9.675 13.5 11.0938 12.9187 12.2563 11.7562C13.4187 10.5937 14 9.175 14 7.5C14 5.825 13.4187 4.40625 12.2563 3.24375C11.0938 2.08125 9.675 1.5 8 1.5C6.325 1.5 4.90625 2.08125 3.74375 3.24375C2.58125 4.40625 2 5.825 2 7.5C2 9.175 2.58125 10.5937 3.74375 11.7562C4.90625 12.9187 6.325 13.5 8 13.5ZM8.075 4.275C8.3875 4.275 8.6595 4.375 8.891 4.575C9.1225 4.775 9.238 5.025 9.2375 5.325C9.2375 5.6 9.15325 5.84375 8.98475 6.05625C8.81625 6.26875 8.6255 6.46875 8.4125 6.65625C8.125 6.90625 7.872 7.18125 7.6535 7.48125C7.435 7.78125 7.3255 8.11875 7.325 8.49375C7.325 8.66875 7.39075 8.81575 7.52225 8.93475C7.65375 9.05375 7.80675 9.113 7.98125 9.1125C8.16875 9.1125 8.32825 9.05 8.45975 8.925C8.59125 8.8 8.6755 8.64375 8.7125 8.45625C8.7625 8.19375 8.875 7.9595 9.05 7.7535C9.225 7.5475 9.4125 7.3505 9.6125 7.1625C9.9 6.8875 10.147 6.5875 10.3535 6.2625C10.56 5.9375 10.663 5.575 10.6625 5.175C10.6625 4.5375 10.4033 4.01575 9.88475 3.60975C9.36625 3.20375 8.763 3.0005 8.075 3C7.6 3 7.147 3.1 6.716 3.3C6.285 3.5 5.95675 3.80625 5.73125 4.21875C5.64375 4.36875 5.61575 4.52825 5.64725 4.69725C5.67875 4.86625 5.763 4.99425 5.9 5.08125C6.075 5.18125 6.25625 5.2125 6.44375 5.175C6.63125 5.1375 6.7875 5.03125 6.9125 4.85625C7.05 4.66875 7.222 4.525 7.4285 4.425C7.635 4.325 7.8505 4.275 8.075 4.275Z" fill="#currentColor" />
              </svg>

              <span className="text-[14px] font-medium group-hover:text-[#FFFFFF]">Help</span>
            </button>

            {/* Logout */}
            <button
              className="group w-full h-10 rounded-[12px] px-2 flex items-center gap-2 hover:bg-[#232327]"
              onClick={async () => {
                onClose();
                await logout();
                navigate('/signin', { replace: true });
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" className="w-5 h-5 text-[#80889B] group-hover:text-[#ED5C5B]" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 2.4375C9.14918 2.4375 9.29226 2.49676 9.39775 2.60225C9.50324 2.70774 9.5625 2.85082 9.5625 3C9.5625 3.14918 9.50324 3.29226 9.39775 3.39775C9.29226 3.50324 9.14918 3.5625 9 3.5625C7.55789 3.5625 6.17484 4.13538 5.15511 5.15511C4.13538 6.17484 3.5625 7.55789 3.5625 9C3.5625 10.4421 4.13538 11.8252 5.15511 12.8449C6.17484 13.8646 7.55789 14.4375 9 14.4375C9.14918 14.4375 9.29226 14.4968 9.39775 14.6023C9.50324 14.7077 9.5625 14.8508 9.5625 15C9.5625 15.1492 9.50324 15.2923 9.39775 15.3977C9.29226 15.5032 9.14918 15.5625 9 15.5625C7.25952 15.5625 5.59032 14.8711 4.35961 13.6404C3.1289 12.4097 2.4375 10.7405 2.4375 9C2.4375 7.25952 3.1289 5.59032 4.35961 4.35961C5.59032 3.1289 7.25952 2.4375 9 2.4375Z" fill="currentColor" />
                <path d="M12.3525 7.14751C12.2531 7.04088 12.199 6.89984 12.2016 6.75412C12.2042 6.60839 12.2632 6.46935 12.3663 6.36629C12.4693 6.26323 12.6084 6.2042 12.7541 6.20163C12.8998 6.19905 13.0409 6.25315 13.1475 6.35251L15.3975 8.60251C15.5028 8.70798 15.562 8.85094 15.562 9.00001C15.562 9.14907 15.5028 9.29204 15.3975 9.39751L13.1475 11.6475C13.096 11.7028 13.0339 11.7471 12.9649 11.7778C12.8959 11.8086 12.8214 11.8251 12.7459 11.8265C12.6704 11.8278 12.5953 11.8139 12.5253 11.7856C12.4553 11.7573 12.3916 11.7152 12.3382 11.6618C12.2848 11.6084 12.2427 11.5447 12.2144 11.4747C12.1861 11.4047 12.1722 11.3296 12.1736 11.2541C12.1749 11.1786 12.1914 11.1041 12.2222 11.0351C12.2529 10.9661 12.2972 10.904 12.3525 10.8525L13.6425 9.56251H7.5C7.35082 9.56251 7.20774 9.50324 7.10225 9.39775C6.99676 9.29227 6.9375 9.14919 6.9375 9.00001C6.9375 8.85082 6.99676 8.70775 7.10225 8.60226C7.20774 8.49677 7.35082 8.43751 7.5 8.43751H13.6425L12.3525 7.14751Z" fill="currentColor" />
              </svg>

              <span className="text-[14px] font-semibold text-[#80889B] group-hover:text-[#ED5C5B]">
                Log Out
              </span>
            </button>


          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileFlyout;
