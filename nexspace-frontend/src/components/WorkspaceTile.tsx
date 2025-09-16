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
        <div className="flex items-center justify-center w-5 h-5">
          <div
            className="w-3 h-3 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "#4D5358" }}
          >
            <div className="w-1.5 h-0.5 bg-white rounded-full" />
          </div>
        </div>
      </div>

    </div>
  );
}
