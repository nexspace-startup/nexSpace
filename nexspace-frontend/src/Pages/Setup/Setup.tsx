import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AccountSetup, { type AccountStep } from "../../components/AccountSetup";
import WorkspaceSetup, { type WorkspaceStep } from "../../components/WorkspaceSetup";
import { api } from "../../services/httpService";
import { ENDPOINTS } from "../../constants/endpoints";
import { useUserStore } from "../../stores/userStore";
import { getMe, type MeResponse } from "../../services/authService";

export default function Setup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"account" | "workspace">("account");
  const [account, setAccount] = useState<Partial<AccountStep>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const setUser = useUserStore((s) => s.setUser);
  const setStatus = useUserStore((s) => s.setStatus);

  function buildOnboardingPayload(ws: WorkspaceStep) {
    return {
      firstName: account.firstName || "",
      lastName: account.lastName || "",
      email: account.email || "",
      password: account.password || undefined,
      company: account.company || undefined,
      role: (account.role as AccountStep["role"]) || "OWNER",
      workspaceName: ws.workspaceName,
      teamSize: ws.teamSize,
    } as const;
  }

  async function handleWorkspaceSubmit(ws: WorkspaceStep) {
    try {
      setIsSubmitting(true);
      const payload = buildOnboardingPayload(ws);
      const res = await api.post(ENDPOINTS.ONBOARDING, payload as any);
      if (res?.data?.success) {
        // refresh session/user and navigate
        const me: MeResponse | null = await getMe();
        if (me?.user) {
          const first = me.user.first_name || "";
          const last = me.user.last_name || "";
          const name = [first, last].filter(Boolean).join(" ") || undefined;
          setUser({ id: me.user.id, name, email: me.user.email });
          setStatus("authed");
        }
        navigate("/dashboard", { replace: true });
      } else {
        alert(res?.data?.errors?.[0]?.message || "Failed to create workspace");
      }
    } catch (e: any) {
      alert(e?.response?.data?.errors?.[0]?.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen w-full bg-[#202024] text-white font-manrope flex flex-col">
      {/* Header brand */}
      <div className="absolute left-9 top-9 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-b from-[#B7F2D4] to-[#48FFA4]" aria-hidden="true" />
        <div className="hidden sm:block text-[20px] font-semibold tracking-[-0.01em]">NexSpace</div>
      </div>

      <div className="flex-1 flex items-center justify-center px-5 py-10">
        {step === "account" ? (
          <AccountSetup
            defaultValues={account}
            onCancel={() => navigate(-1)}
            onNext={(data) => {
              setAccount(data);
              setStep("workspace");
            }}
          />
        ) : (
          <WorkspaceSetup
            onBack={() => setStep("account")}
            isSubmitting={isSubmitting}
            onSubmit={handleWorkspaceSubmit}
          />
        )}
      </div>
    </main>
  );
}
