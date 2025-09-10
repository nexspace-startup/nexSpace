import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import quill_link from "../assets/quill_link.svg"

// Optional email: blank is allowed; if present, must be a valid email
const schema = z.object({
  email: z
    .string()
    .optional()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: "Enter a valid email",
    }),
});

type FormValues = z.infer<typeof schema>;

type Props = { finalSubmit: () => void;};

export default function InvitationSetup({ finalSubmit }: Props) {
  const {
    register,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { email: "" },
  });

  // watching email is not currently used in UI; remove to avoid TS6133

  const addInvite = () => {
    alert("Invite sent (not really, this is a placeholder).");
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText("");
    } catch {
      // ignore (no toast lib in this snippet)
    }
  };

  return (
    <div className="w-full max-w-[520px] px-6 py-8 section-pad space-y-6">
      <div>
        <h1 className="heading-xl">Invite team members</h1>
      </div>

      {/* <div>
        <label className="label">Email</label>
        <input
          type="email"
          placeholder="teammate@company.com"
          {...register("email")}
          className={`input-base ${
            errors.email ? "input-error" : "input-normal"
          }`}
        />
        {errors.email && (
          <p className="error-text">{errors.email.message}</p>
        )}
        {!errors.email && email && (
          <p className="text-sm text-green-600 mt-1">✓ Valid email</p>
        )}
      </div> */}

      {/* Email + Invite */}
      <label className="block text-sm font-medium text-[#111827]">Email</label>
      <div className="flex items-stretch gap-3">
        <input
          type="email"
          placeholder="email@domain.com"
          className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#111827] focus:ring-2 focus:ring-[#111827]/15"
          {...register("email")}
        />
        <button
          type="button"
          onClick={addInvite}
          className="rounded-xl border border-[#D1D5DB] px-4 text-sm text-[#111827] hover:bg-[#F9FAFB]"
        >
          Invite
        </button>
      </div>
      {errors.email && (
        <p className="mt-1 text-xs text-[#DC2626]">{errors.email.message}</p>
      )}

      {/* Copy link */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center gap-2 text-sm text-[#3B82F6] hover:underline"
        >
          {/* link icon */}
          <img src={quill_link} alt="" aria-hidden="true" className="h-4 w-4 shrink-0" />
          Copy Link
        </button>
      </div>

      {/* Divider */}
      <div className="my-6 h-px w-full bg-[#F3F4F6]" />

      <div className="mb-4">
        <h2 className="mb-3 text-sm font-medium text-[#111827]">Team Members</h2>
        <ul className="space-y-3">
          <li className="text-sm text-[#6B7280]">No invites yet.</li>
        </ul>
      </div>

      {/* Button intentionally has no behavior */}
      <button type="button" className="btn-primary mt-8" onClick={() => finalSubmit()}>
        Continue to Nexspace
      </button>
    </div>
  );
}
