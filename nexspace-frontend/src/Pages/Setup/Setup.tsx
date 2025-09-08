import React from "react";
import { useNavigate } from 'react-router-dom';
import ProgressBar from "../../components/ProgressBar";
import AccountSetup from "../../components/AccountSetup";
import WorkspaceSetup from "../../components/WorkspaceSetup";
import InvitationSetup from "../../components/InvitationSetup";
import type { AccountData, WorkspaceData, OnboardingPayload } from "../../types";
import "./Setup.css"; // import the shared styles
import Sidebar from "../../components/Setup/_nexSideBar";
import { api } from "../../services/httpService";


const steps = [
  { id: "account", label: "Account" },
  { id: "workspace", label: "Workspace" },
  { id: "invite", label: "Invite" },
] as const;

export default function Setup() {
  const navigate = useNavigate();
  const [index, setIndex] = React.useState(0);
  const [account, setAccount] = React.useState<Partial<AccountData>>({});
  const [workspace, setWorkspace] = React.useState<Partial<WorkspaceData>>({});
  const [isLoading, setIsLoading] = React.useState(false);
  //const [invites, setInvites] = React.useState<Partial<InviteData>>({ invites: [] });

  const next = () => setIndex((i) => Math.min(i + 1, steps.length - 1));

  const finalSubmit = async () => {
    //setInvites(inviteData);
    const payload: OnboardingPayload = {
      ...(account as AccountData),
      ...(workspace as WorkspaceData),
      //...(inviteData as InviteData),
    };
    try {
      setIsLoading(true);
      payload.role = "OWNER"
      const res = await api.post("/onboarding", payload)

      if (res?.data?.success === true) {
        // Success → alert with workspace name or a simple message
        setIsLoading(false);
        alert(`Workspace "${res.data?.workspaceName}" created successfully!`)
        // Redirect to dashboard
        navigate('/dashboard');

      }
    } catch (err: any) {
      // Error handling
      setIsLoading(false);
      console.log(err);
      if (err.response) {
        alert(`Error: ${err?.response?.data?.error}`)
      } else {
        alert("Something went wrong")
      }
    };
  };

  const onStepClick = (targetIndex: number) => {
    // allow only going to current or previous steps
    setIndex((current) => (targetIndex <= current ? targetIndex : current));
  };

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <main className="flex-1 relative bg-white">
        <div className="absolute left-10 w-[460px]">
          <ProgressBar currentStep={index} onStepClick={onStepClick} />

        </div>

        <div className="flex h-full items-center justify-center">
          {index === 0 && (
            <AccountSetup
              defaultValues={account}
              onValidNext={(d) => { setAccount(d); next(); }}
            />
          )}

          {index === 1 && (
            <WorkspaceSetup
              defaultValues={workspace}
              onValidNext={(d) => { setWorkspace(d); next(); }}
            />
          )}

          {index === 2 && (
            <InvitationSetup finalSubmit={finalSubmit}
            />
          )}
        </div>
      </main>
      {isLoading && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-16 w-16"></div>
                </div>
            )}
    </div>
  );
}
