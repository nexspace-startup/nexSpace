export type WorkspaceTileProps = {
  name: string;
  initials: string;
  onTileClick: () => void;
  active?: boolean;
};

export default function WorkspaceTile({
  name,
  initials,
  onTileClick,
  active,
}: WorkspaceTileProps) {
  return (
    <div
      role="button"                      // makes it accessible as a button
      onClick={onTileClick}
      className={`
        flex items-center gap-2 w-full h-12 rounded-xl transition-colors cursor-pointer
        px-2 py-2.5
        ${active ? "bg-zinc-800" : "hover:bg-zinc-800"}
      `}
      style={{ backgroundColor: active ? "#202024" : "transparent" }}
    >
      {/* Icon */}
      <div
        className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
        style={{ backgroundColor: "#FFCAA9" }}
      >
        <span className="text-sm font-medium text-zinc-900 font-manrope">
          {initials}
        </span>
      </div>

      {/* Name */}
      <span className="text-sm font-small text-white font-manrope truncate" aria-label={name} title={name}>
        {name}
      </span>

      {/* Right side status only when expanded */}
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          aria-label="Workspace options"
          className="hidden md:grid w-7 h-7 rounded-full place-items-center text-white/70 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
            <circle cx="6" cy="12" r="1.6" fill="currentColor"/>
            <circle cx="12" cy="12" r="1.6" fill="currentColor"/>
            <circle cx="18" cy="12" r="1.6" fill="currentColor"/>
          </svg>
        </button>
      </div>

    </div>
  );
}
