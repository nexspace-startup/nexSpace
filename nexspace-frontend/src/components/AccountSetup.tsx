import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { AccountData } from "../types";
import { useUserStore } from "../stores/userStore";

const schema = z.object({
  firstName: z.string().min(1, "First name is required")
  .regex(/^[A-Za-z\s'-]+$/, "First name can only contain letters, spaces, apostrophes, and hyphens"),
  lastName: z.string().min(1, "Last name is required")
  .regex(/^[A-Za-z\s'-]+$/, "First name can only contain letters, spaces, apostrophes, and hyphens"),
  email: z.string().email("Enter a valid email"),
  role: z.enum(["Owner", "Admin", "Member"]).refine((val) => ["Owner", "Admin", "Member"].includes(val), {
    message: "Select a valid role",
  }),
  company: z.string().max(60).optional(),
});

type Props = { defaultValues?: Partial<AccountData>; onValidNext: (d: AccountData) => void; };

export default function AccountSetup({ defaultValues, onValidNext }: Props) {
  const user = useUserStore((state) => state.user);
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<AccountData>({
      resolver: zodResolver(schema),
      mode: "onSubmit",
      defaultValues: { firstName: "", lastName: "", email: user?.email, role: "Owner", company: "", ...defaultValues },
    });

  return (
    <form
      onSubmit={handleSubmit(onValidNext)}
      className="w-full max-w-[520px] px-6 py-8 section-pad space-y-6"
    >
      <div>
        <h1 className="heading-xl">Personal Info</h1>
        <p className="subheading">fill out your personal info</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">First Name*</label>
          <input
            {...register("firstName")}
            className={`input-base ${errors.firstName ? "input-error" : "input-normal"}`}
            placeholder="Jane"
          />
          {errors.firstName && <p className="error-text">{errors.firstName.message}</p>}
        </div>
        <div>
          <label className="label">Last Name*</label>
          <input
            {...register("lastName")}
            className={`input-base ${errors.lastName ? "input-error" : "input-normal"}`}
            placeholder="Doe"
          />
          {errors.lastName && <p className="error-text">{errors.lastName.message}</p>}
        </div>
      </div>

      <div>
        <label className="label">Email*</label>
        <input
          type="email"
          autoComplete="email"
          {...register("email")}
          disabled={!!user?.email}
          className={`input-base ${errors.email ? "input-error" : "input-normal"}`}
          placeholder="you@nexspace.com"
        />
        {errors.email && <p className="error-text">{errors.email.message}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Role*</label>
          <select
            {...register("role")}
            className={`select-base ${errors.role ? "select-error" : "select-normal"}`}
          >
            <option value="Owner">Owner</option>
            <option value="Admin">Admin</option>
            <option value="Member">Member</option>
          </select>
          {errors.role && <p className="error-text">{errors.role.message}</p>}
        </div>

        <div>
          <label className="label">Company</label>
          <input
            {...register("company")}
            className="input-base input-normal"
            placeholder="Nexspace"
          />
        </div>
      </div>

      <button type="submit" disabled={isSubmitting} className="btn-primary">
        Continue
      </button>
    </form>
  );
}
