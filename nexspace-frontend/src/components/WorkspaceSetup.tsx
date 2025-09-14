import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

export type WorkspaceStep = {
  workspaceName: string;
  teamSize?: "1-5" | "6-10" | "11-25" | "26-50" | "51-100" | "100+";
};

type Props = {
  defaultValues?: Partial<WorkspaceStep>;
  onBack: () => void;
  onSubmit: (data: WorkspaceStep) => void;
  isSubmitting?: boolean;
};

const schema = z.object({
  workspaceName: z
    .string()
    .min(2, "Workspace name must be at least 2 characters")
    .max(120, "Workspace name must be at most 120 characters"),
  teamSize: z.enum(["1-5", "6-10", "11-25", "26-50", "51-100", "100+"]).optional(),
});

export default function WorkspaceSetup({ defaultValues, onBack, onSubmit, isSubmitting }: Props) {
  const { register, handleSubmit, formState: { errors, isSubmitting: isFormSubmitting } } =
    useForm<WorkspaceStep>({
      resolver: zodResolver(schema),
      mode: "onSubmit",
      defaultValues: { workspaceName: "", teamSize: "1-5", ...defaultValues },
    });

  function handleLocalSubmit(ws: WorkspaceStep) {
    onSubmit(ws);
  }

  return (
    <div className="w-full max-w-[580px] flex flex-col items-center gap-6 sm:gap-8">
      {/* Title outside the card */}
      <div className="w-full max-w-[400px] self-center flex flex-col items-center gap-2">
        <h1 className="text-center font-bold tracking-[-0.01em] text-2xl">Setup Your Workspace</h1>
        <p className="text-center text-sm sm:text-base opacity-95">Name your workspace and team size</p>
      </div>

      {/* Form content (no dark card background) */}
      <form id="workspace-setup-form" onSubmit={handleSubmit(handleLocalSubmit)} className="w-full max-w-[500px] flex flex-col gap-7 sm:gap-[28px]">
        <div className="w-full h-[220px] sm:h-[300px] rounded-2xl bg-gradient-to-br from-[#B7F2D4] to-[#48FFA4]" aria-hidden="true" />

        <div className="flex flex-col gap-2">
          <label className="text-sm">Workspace Name*</label>
          <input
            {...register("workspaceName")}
            className={`h-14 rounded-2xl px-4 bg-[rgba(128,136,155,0.10)] border ${errors.workspaceName ? "border-[#FF6060]" : "border-[#26272B]"}`}
            placeholder="e.g., Nexspace Core"
          />
          {errors.workspaceName && <p className="text-[#FF6060] text-xs">{String(errors.workspaceName.message)}</p>}
        </div>
      </form>

      {/* Break line between card and CTA */}
      <hr className="w-full border-[#26272B]" />

      {/* CTA row outside the card */}
      <div className="flex items-center justify-between w-full">
        <button type="button" onClick={onBack} className="h-10 px-4 rounded-xl bg-[rgba(128,136,155,0.25)]">Back</button>
        <button form="workspace-setup-form" type="submit" disabled={isSubmitting || isFormSubmitting} className="h-10 px-6 rounded-xl bg-[#4285F4] text-white disabled:opacity-60">Create Workspace</button>
      </div>
    </div>
  );
}
