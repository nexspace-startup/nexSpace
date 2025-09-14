import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUserStore } from "../stores/userStore";

export type AccountStep = {
  firstName: string;
  lastName: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  company?: string;
  password?: string;
  confirmPassword?: string;
};

type Props = {
  defaultValues?: Partial<AccountStep>;
  onNext: (d: AccountStep) => void;
  onCancel?: () => void;
};

const passwordRules = {
  length: (v: string) => v.length >= 8,
  upper: (v: string) => /[A-Z]/.test(v),
  lower: (v: string) => /[a-z]/.test(v),
  digit: (v: string) => /\d/.test(v),
  special: (v: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(v),
};

export default function AccountSetup({ defaultValues, onNext, onCancel }: Props) {
  const user = useUserStore((s) => s.user);
  const status = useUserStore((s) => s.status);
  // Infer OAuth pre-onboarding: authenticated session exists, but DB user id isn't attached yet
  const isOAuth = status === "authed" && !user?.id
  const schema: z.ZodType<AccountStep> = useMemo(() => {
    const core = z.object({
      firstName: z
        .string()
        .min(2, "First name is required")
        .regex(/^[A-Za-z\-']+$/, "Only letters, hyphens, apostrophes"),
      lastName: z
        .string()
        .min(2, "Last name is required")
        .regex(/^[A-Za-z\-']+$/, "Only letters, hyphens, apostrophes"),
      email: z.string().email("Enter a valid email"),
      role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
      company: z.string().max(60).optional().or(z.literal("")),
    });
    if (isOAuth) {
      return core.extend({
        password: z.string().optional(),
        confirmPassword: z.string().optional(),
      });
    }
    return core
      .extend({
        password: z
          .string()
          .min(8, "At least 8 characters")
          .refine(passwordRules.upper, "Add an uppercase letter")
          .refine(passwordRules.lower, "Add a lowercase letter")
          .refine(passwordRules.digit, "Add a number")
          .refine(passwordRules.special, "Add a special character"),
        confirmPassword: z.string(),
      })
      .refine((d) => d.password === d.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
  }, [isOAuth]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<AccountStep>({
    resolver: zodResolver(schema as any) as any,
    mode: "onSubmit",
    defaultValues: {
      firstName: "",
      lastName: "",
      email: user?.email || "",
      role: "OWNER",
      company: "",
      password: "",
      confirmPassword: "",
      ...defaultValues,
    },
  });

  const password = watch("password") || "";
  const [pwFocused, setPwFocused] = useState(false);

  return (
    <div className="w-full max-w-[580px] flex flex-col items-center gap-6 sm:gap-8">
      {/* Title outside the card */}
      <div className="w-full max-w-[400px] self-center flex flex-col items-center gap-2">
        <h1 className="text-center font-bold tracking-[-0.01em] text-2xl">Personal Info</h1>
        <p className="text-center text-sm sm:text-base opacity-95">Fill out your personal information</p>
      </div>

      {/* Card form */}
      <form id="account-setup-form" onSubmit={handleSubmit(onNext)} className="w-full bg-[#18181B] rounded-2xl p-6 sm:p-10 flex flex-col gap-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
          <div className="flex flex-col gap-2">
            <label className="text-sm">First Name*</label>
            <input
              {...register("firstName")}
              className={`h-10 rounded-2xl px-4 bg-[rgba(128,136,155,0.10)] border ${errors.firstName ? "border-[#FF6060]" : "border-[#26272B]"}`}
            />
            {errors.firstName && <p className="text-[#FF6060] text-xs">{String(errors.firstName.message)}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm">Last Name*</label>
            <input
              {...register("lastName")}
              className={`h-10 rounded-2xl px-4 bg-[rgba(128,136,155,0.10)] border ${errors.lastName ? "border-[#FF6060]" : "border-[#26272B]"}`}
            />
            {errors.lastName && <p className="text-[#FF6060] text-xs">{String(errors.lastName.message)}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm">Email*</label>
          <input
            type="email"
            autoComplete="email"
            {...register("email")}
            disabled={!!user?.email}
            className={`h-10 rounded-2xl px-4 bg-[rgba(128,136,155,0.25)] border ${errors.email ? "border-[#FF6060]" : "border-[#26272B]"}`}
          />
          {errors.email && <p className="text-[#FF6060] text-xs">{String(errors.email.message)}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm">Designation*</label>
          <select
            {...register("role")}
            className={`h-10 rounded-2xl px-4 bg-[rgba(128,136,155,0.10)] border ${errors.role ? "border-[#FF6060]" : "border-[#26272B]"}`}
          >
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="MEMBER">Member</option>
          </select>
          {errors.role && <p className="text-[#FF6060] text-xs">{String(errors.role.message)}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm">Company</label>
          <input
            {...register("company")}
            className={`h-10 rounded-2xl px-4 bg-[rgba(128,136,155,0.10)] border border-[#26272B]`}
          />
        </div>

        {!isOAuth && <hr className="border-[#26272B]" />}

        {!isOAuth && (
          <div className="flex flex-col gap-2 relative">
            <label className="text-sm">Password*</label>
            <input
              type="password"
              {...register("password")}
              onFocus={() => setPwFocused(true)}
              onBlur={() => setPwFocused(false)}
              className={`h-10 rounded-2xl px-4 bg-[rgba(128,136,155,0.10)] border ${errors.password ? "border-[#FF6060]" : "border-[#26272B]"}`}
            />
            {errors.password && <p className="text-[#FF6060] text-xs">{String(errors.password.message)}</p>}

            {pwFocused && (
              <div className="absolute z-10 right-0 top-[52px] w-72 bg-[#333336] rounded-lg p-4 shadow-lg">
                <p className="text-[14px] font-bold mb-3">Your password must contain</p>
                <ul className="space-y-2 text-[12px]">
                  {[
                    { ok: passwordRules.length(password), label: "At least 8 characters" },
                    { ok: passwordRules.upper(password), label: "At least 1 uppercase" },
                    { ok: passwordRules.lower(password), label: "At least 1 lowercase" },
                    { ok: passwordRules.digit(password), label: "At least 1 number" },
                    { ok: passwordRules.special(password), label: "At least 1 special character" },
                  ].map((r, i) => (
                    <li key={i} className={`flex items-center gap-2 ${r.ok ? "text-[#48FFA4]" : "text-[#FF6060]"}`}>
                      <span className={`inline-block w-4 h-4 rounded-full ${r.ok ? "bg-[#48FFA4]" : "bg-[#FF6060]"}`} />
                      {r.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!isOAuth && (
          <div className="flex flex-col gap-2">
            <label className="text-sm">Confirm Password*</label>
            <input
              type="password"
              {...register("confirmPassword")}
              className={`h-10 rounded-2xl px-4 bg-[rgba(128,136,155,0.10)] border ${errors.confirmPassword ? "border-[#FF6060]" : "border-[#26272B]"}`}
            />
            {errors.confirmPassword && (
              <p className="text-[#FF6060] text-xs">{String(errors.confirmPassword.message)}</p>
            )}
          </div>
        )}

      </form>

      {/* Break line between card and CTA */}
      <hr className="w-full border-[#26272B]" />

      {/* CTA row outside the card */}
      <div className="flex items-center justify-center gap-5 w-full">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 px-4 rounded-xl bg-[rgba(128,136,155,0.25)]"
        >
          Cancel
        </button>
        <button form="account-setup-form" type="submit" disabled={isSubmitting} className="h-10 px-6 rounded-xl bg-[#4285F4] text-white">
          Setup Workspace
        </button>
      </div>
    </div>
  );
}
