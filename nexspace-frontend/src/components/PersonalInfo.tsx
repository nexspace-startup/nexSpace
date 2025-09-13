/** @jsxImportSource react */
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUserStore } from "../stores/userStore";

const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .regex(/[A-Z]/, "At least 1 uppercase")
  .regex(/[0-9]/, "At least 1 number");

const schema = z
  .object({
    firstName: z
      .string()
      .min(1, "First name is required")
      .regex(/^[A-Za-z\s'-]+$/, "Only letters, spaces, apostrophes, and hyphens allowed"),
    lastName: z
      .string()
      .min(1, "Last name is required")
      .regex(/^[A-Za-z\s'-]+$/, "Only letters, spaces, apostrophes, and hyphens allowed"),
    email: z.string().email("Enter a valid email"),
    role: z.enum(["Owner", "Admin", "Member"]).refine(
      (val) => ["Owner", "Admin", "Member"].includes(val),
      { message: "Please select a valid role" }
    ),
    company: z.string().max(60).optional(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type FormData = z.infer<typeof schema>;

interface Props {
  onValidNext: (data: FormData) => void;
  defaultEmail?: string;
}

export default function PersonalInformation({ onValidNext, defaultEmail }: Props) {
  const user = useUserStore()
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
    trigger,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { email: defaultEmail || "" },
  });

  const passwordValue = watch("password");
  const confirmPasswordValue = watch("confirmPassword");

  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    number: false,
  });

  // Re-check password validity on change
  useEffect(() => {
    setPasswordChecks({
      length: passwordValue?.length >= 8,
      uppercase: /[A-Z]/.test(passwordValue || ""),
      number: /[0-9]/.test(passwordValue || ""),
    });

    // re-validate confirm password when password changes
    if (confirmPasswordValue) {
      trigger("confirmPassword");
    }
  }, [passwordValue, confirmPasswordValue, trigger]);

  const onSubmit = (data: FormData) => {
    onValidNext(data);
  };

  return (
    <div className="relative w-screen h-screen bg-[#202024] flex items-center justify-center">
      <div className="w-[580px] h-[870px] flex flex-col items-center gap-10">
        {/* Title */}
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-white text-2xl font-bold">Personal Info</h1>
          <p className="text-white text-base font-medium">
            Fill out your personal information
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="w-[580px] bg-[#18181B] rounded-2xl p-10 flex flex-col gap-10"
        >
          {/* Names */}
          <div className="flex gap-5">
            <div className="flex flex-col w-1/2 gap-1">
              <label className="text-white text-sm">First Name *</label>
              <input
                {...register("firstName")}
                className="p-3 rounded-xl bg-[#202024] border border-[#26272B] text-white"
              />
              {errors.firstName && (
                <span className="text-red-500 text-xs">{errors.firstName.message}</span>
              )}
            </div>

            <div className="flex flex-col w-1/2 gap-1">
              <label className="text-white text-sm">Last Name *</label>
              <input
                {...register("lastName")}
                className="p-3 rounded-xl bg-[#202024] border border-[#26272B] text-white"
              />
              {errors.lastName && (
                <span className="text-red-500 text-xs">{errors.lastName.message}</span>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1">
            <label className="text-white text-sm">Email *</label>
            <input
              {...register("email")} value={user.user?.email}
              disabled
              className="p-3 rounded-xl bg-[#202024] border border-[#26272B] text-gray-500"
            />
          </div>

          {/* Role */}
          <div className="flex flex-col gap-1">
            <label className="text-white text-sm">Designation *</label>
            <select
              {...register("role")}
              className="p-3 rounded-xl bg-[#202024] border border-[#26272B] text-white"
              defaultValue=""
            >
              <option value="" disabled>
                Select a role
              </option>
              <option value="Owner">Owner</option>
              <option value="Admin">Admin</option>
              <option value="Member">Member</option>
            </select>
            {errors.role && (
              <span className="text-red-500 text-xs">{errors.role.message}</span>
            )}
          </div>

          {/* Company */}
          <div className="flex flex-col gap-1">
            <label className="text-white text-sm">Company</label>
            <input
              {...register("company")}
              className="p-3 rounded-xl bg-[#202024] border border-[#26272B] text-white"
            />
          </div>

          {/* Password + live check */}
          <div className="flex flex-col gap-1 relative">
            <label className="text-white text-sm">Password *</label>
            <input
              type="password"
              {...register("password")}
              className={`p-3 rounded-xl border ${errors.password ? "border-red-500" : "border-[#26272B]"
                } bg-[#202024] text-white`}
            />
            {/* Password checker floating */}
            {passwordValue && (
              <div className="absolute right-[-300px] top-0 bg-[#333336] rounded-xl p-4 w-[260px] text-xs">
                <p className="text-white font-semibold mb-2">Your password must contain</p>
                <ul className="flex flex-col gap-2">
                  <li className={`flex items-center gap-2 ${passwordChecks.length ? "text-green-400" : "text-red-500"}`}>
                    ● At least 8 characters
                  </li>
                  <li className={`flex items-center gap-2 ${passwordChecks.uppercase ? "text-green-400" : "text-red-500"}`}>
                    ● At least 1 uppercase
                  </li>
                  <li className={`flex items-center gap-2 ${passwordChecks.number ? "text-green-400" : "text-red-500"}`}>
                    ● At least 1 number
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="flex flex-col gap-1">
            <label className="text-white text-sm">Confirm Password *</label>
            <input
              type="password"
              {...register("confirmPassword")}
              disabled={!passwordChecks.length || !passwordChecks.uppercase || !passwordChecks.number}
              className={`p-3 rounded-xl border ${errors.confirmPassword ? "border-red-500" : "border-[#26272B]"
                } bg-[#202024] text-white disabled:opacity-50`}
            />
            {errors.confirmPassword && (
              <span className="text-red-500 text-xs">{errors.confirmPassword.message}</span>
            )}
          </div>

          {/* Footer buttons */}
          <div className="flex justify-center gap-5 mt-6 sticky bottom-0">
            <button
              type="button"
              className="px-6 py-2 rounded-xl bg-gray-600 text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className={`px-6 py-2 rounded-xl text-white flex items-center gap-2 ${isValid ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-500 cursor-not-allowed"
                }`}
            >
              Setup Workspace →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
