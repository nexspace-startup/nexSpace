type Props = {
  /** 0: Account, 1: Workspace, 2: Invite */
  currentStep: number;
  onStepClick?: (index: number) => void;
};

export default function ProgressBar({ currentStep, onStepClick }: Props) {
  // 3 steps (0..2)
  const railWidth = 400;
  const progressPx = (railWidth * currentStep) / 2;

  const canGo = (idx: number) => idx <= currentStep;
  const go = (idx: number) => {
    if (onStepClick && canGo(idx)) onStepClick(idx);
  };

  return (
    <div className="absolute left-10 top-6 w-[860px]">
      {/* Rail + fill + knob (anchored at 270px, 3px tall) */}
      <div className="relative h-[62px]">
        <div className="absolute left-[270px] top-[27px]">
          <div className="relative h-[3px] w-[400px] rounded-full bg-[#F2F2F2]">
            {/* filled segment with gradient (blue -> dark) */}
            <div
              className="absolute left-0 top-0 h-[3px] rounded-full"
              style={{
                width: Math.max(progressPx, 8), // ensure tiny visible fill at step 0
                background:
                  "linear-gradient(90deg, rgba(66,133,244,0.9) 0%, #212121 70%)",
              }}
            />
            {/* knob */}
            <div
              className={[
                "absolute -top-[5px] h-3 w-3 rounded-full",
                "bg-[#212121] shadow-sm",
                // thin contrast rim like native sliders
                "ring-1 ring-white/80",
              ].join(" ")}
              style={{
                left: `calc(${progressPx}px - 6px)`, // center the 12px knob on the fill end
              }}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      {/* Step labels (clickable back/current; future disabled) */}
      <div className="absolute left-[242px] top-[40px] flex gap-[160px] text-[14px] leading-[21px]">
        {/* Account */}
        <button
          type="button"
          onClick={() => go(0)}
          className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[#4285F4]"
          style={{ fontFamily: "Mulish, ui-sans-serif, system-ui" }}
        >
          <span
            className={`font-bold ${
              currentStep >= 0 ? "text-[#212121]" : "text-[#343434]/40"
            } ${canGo(0) ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
          >
            Account
          </span>
        </button>

        {/* Workspace */}
        <button
          type="button"
          onClick={() => go(1)}
          className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[#4285F4]"
          style={{ fontFamily: "Mulish, ui-sans-serif, system-ui" }}
          disabled={!canGo(1)}
          title={!canGo(1) ? "Complete previous steps to proceed" : ""}
        >
          <span
            className={`font-medium ${
              currentStep >= 1 ? "text-[#212121]" : "text-[#343434]/40"
            } ${canGo(1) ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
          >
            Workspace
          </span>
        </button>

        {/* Invite */}
        <button
          type="button"
          onClick={() => go(2)}
          className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[#4285F4]"
          style={{ fontFamily: "Mulish, ui-sans-serif, system-ui" }}
          disabled={!canGo(2)}
          title={!canGo(2) ? "Complete previous steps to proceed" : ""}
        >
          <span
            className={`font-medium ${
              currentStep >= 2 ? "text-[#212121]" : "text-[#343434]/40"
            } ${canGo(2) ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
          >
            Invite
          </span>
        </button>
      </div>

      {/* Divider under header */}
      <div className="absolute left-0 top-[85px] h-px w-[860px] bg-[#F2F2F2]" />
    </div>
  );
}
