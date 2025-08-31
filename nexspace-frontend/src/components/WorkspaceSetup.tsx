import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { WorkspaceData } from "../types";

const schema = z.object({
  workspaceName: z.string()
    .min(2, "Workspace name must be at least 2 characters")
    .max(50, "Workspace name must be 50 characters or fewer")
    .regex(/^[\p{L}\p{N}\s.'-]+$/u, "Only letters, numbers, spaces, . ' - are allowed"),
  teamSize: z.enum(["1-5","6-10","11-25","26-50","51-100","100+"]).refine((val) => ["1-5","6-10","11-25","26-50","51-100","100+"].includes(val), {
    message: "Select a valid team size",
  }),
});

type Props = { defaultValues?: Partial<WorkspaceData>; onValidNext: (d: WorkspaceData) => void; };

export default function WorkspaceSetup({ defaultValues, onValidNext }: Props) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<WorkspaceData>({
      resolver: zodResolver(schema),
      mode: "onSubmit",
      defaultValues: { workspaceName: "", teamSize: "1-5", ...defaultValues },
    });

  return (
    <form
      onSubmit={handleSubmit(onValidNext)}
      className="w-full max-w-[520px] px-6 py-8 section-pad space-y-6"
      noValidate
    >
      <div>
        <h1 className="heading-xl">Setup Your Workspace</h1>
        <p className="subheading">fill out your workspace info</p>
      </div>

      <div>
        <label className="label">Team Name*</label>
        <input
          {...register("workspaceName")}
          className={`input-base ${errors.workspaceName ? "input-error" : "input-normal"}`}
          placeholder="e.g., Nexspace Core"
        />
        {errors.workspaceName && <p className="error-text">{errors.workspaceName.message}</p>}
      </div>

      <div>
        <label className="label">Team Size*</label>
        <select
          defaultValue=""
          {...register("teamSize")}
          className={`select-base ${errors.teamSize ? "select-error" : "select-normal"}`}
        >
          <option value="" disabled>Select</option>
          <option value="1-5">1–5</option>
          <option value="6-10">6–10</option>
          <option value="11-25">11–25</option>
          <option value="26-50">26–50</option>
          <option value="51-100">51–100</option>
          <option value="100+">100+</option>
        </select>
        {errors.teamSize && <p className="error-text">{errors.teamSize.message}</p>}
      </div>

      <button type="submit" disabled={isSubmitting} className="btn-primary">
        Continue
      </button>
    </form>
  );
}
