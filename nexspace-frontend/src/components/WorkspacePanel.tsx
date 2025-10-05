// src/components/workspace/WorkspacePanel.tsx
import React, { useEffect, useRef, useState } from "react";
import { useUIStore } from "../stores/uiStore";
import { useWorkspaceStore, type Workspace } from "../stores/workspaceStore";
import WorkspaceTile from "./WorkspaceTile";
import minimiseIcon from "../assets/minimise_icon.svg";
import maximiseIcon from "../assets/maximise_icon.svg";
// import { api } from "../services/httpService";
import { inviteUser } from "../services/dashboardService";
import { toast } from "../stores/toastStore";
import { WorkspaceRoleConstant, type WorkSpaceRole } from "../constants/enums";
import WorkspaceImg from '../assets/Workspace.png'
import deleteIcon from '../assets/delete_vector.svg'
import copyIcon from '../assets/copy.svg'
import addUserIcon from '../assets/user_add.svg'
import editIcon from '../assets/edit_icon.svg'
import { AuthService } from "../services/authService";
function initialsFrom(name: string): string {
  const parts = name?.trim().split(/\s+/).slice(0, 2) ?? [];
  return parts.map((p) => p?.[0]?.toUpperCase() ?? "").join("") || "W";
}

const PANEL_WIDTH = 230;
const PANEL_EXTRA_MAX = 50;

const WorkspacePanel: React.FC = () => {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActive = useWorkspaceStore((s) => s.setActiveWorkspace);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace);
  const updateWorkSpace = useWorkspaceStore((s) => s.updateWorkspace);
  const fetchWorkSpace = useWorkspaceStore((s) => s.fetchWorkspaces)
  const [createdWorkSpaceId, setcreatedWorkSpaceId] = useState<Workspace>();
  const [InviteType, setInviteType] = useState(0)
  // NEW: search results (for invite step)
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const isOpen = useUIStore((s) => s.isWorkspacePanelOpen);
  const toggle = useUIStore((s) => s.toggleWorkspacePanel);
  // const [inviteeWorkSpace, setinviteeWorkSpace] = useState("");
  const [extraWidth, setExtraWidth] = useState(0);
  const [dragging, setDragging] = useState(false);

  // Options flyout
  const [optionsFor, setOptionsFor] = useState<{
    id: string;
    name: string;
    anchorRect: DOMRect;
    role: WorkSpaceRole
  } | null>(null);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{ id: string; name: string } | null>(null);
  const [panelInvite, setPanelInvite] = useState<{ id: string, name: string } | null>(null)
  const [deleting, setDeleting] = useState(false);

  // Create / Invite modal
  const [createOpen, setCreateOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);

  // Invite step
  const [inviteInput, setInviteInput] = useState("");
  // CHANGED: invited holds user objects so we can show initials, name, email
  const [invited, setInvited] = useState<any[]>([]);

  const dragStartX = useRef(0);
  const dragStartExtra = useRef(0);

  // Scroll (shared for all scrollable lists to toggle the 'scrolling' class)
  const listRef = useRef<HTMLDivElement | null>(null);
  const scrollTimer = useRef<number | null>(null);
  const [scrolling, setScrolling] = useState(false);
  // NEW: to check if current input is a valid email from searchResults
  const [isValidEmail, setIsValidEmail] = useState(false);
  const handleAnyScroll = () => {
    if (!scrolling) setScrolling(true);
    if (scrollTimer.current) window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => setScrolling(false), 800);
  };

  // Resize
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartX.current;
      const next = Math.min(PANEL_EXTRA_MAX, Math.max(0, dragStartExtra.current + dx));
      setExtraWidth(next);
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp, { once: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  useEffect(() => {
    if (dragging) {
      const prev = document.body.style.cursor;
      document.body.style.cursor = "ew-resize";
      return () => {
        document.body.style.cursor = prev;
      };
    }
  }, [dragging]);

  // Actions
  const handleInvite = (id: string, name: string) => {
    console.log("Invite members for workspace:", id, name);
    setPanelInvite({ id, name })
    setCreateOpen(true)
    setCreateStep(2)
    setInviteType(2)
    setOptionsFor(null)
  };

  const handleEdit = (id: string, name: string) => {
    setEditTarget({ id, name })
    setCreateOpen(true)
    setCreateStep(3)
    setOptionsFor(null);
    setWorkspaceName(name)
  };

  const handleDelete = (id: string, name: string) => {
    setOptionsFor(null);
    setDeleteTarget({ id, name });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteWorkspace(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete workspace:", err);
    } finally {
      setDeleting(false);
    }
  };

  const confirmCreateUpdate = async (type: number) => {
    console.log(optionsFor)
    console.log(WorkspaceRoleConstant)
    if (!workspaceName.trim()) return;
    try {
      setCreating(true);
      const res = type == 1 ? await createWorkspace(workspaceName.trim()) :
        type == 2 && editTarget?.id && editTarget?.name ? await updateWorkSpace(editTarget?.id, workspaceName.trim()) : ""
      if (res) {
        if (type == 1) {
          setWorkspaceName(res.name); setCreateStep(2); setInviteInput(""); setSearchResults([]); setInvited([]); setInviteType(1)
        } else if (type == 2) {
          setCreateOpen(false); setWorkspaceName("")
        }
        fetchWorkSpace()
      } else {
        toast.error("Failed to create workspace" + workspaceName, 1)
      }
    } catch (err) {
      console.error("Failed to create workspace:", err);
    } finally {
      setCreating(false);
    }
  };
  // const handleInviteMember = async () => {
  //   debugger
  //   console.log(inviteInput, isValidEmail)
  //   if (!inviteInput.trim() || !isValidEmail) return;
  //   setIsValidEmail(true);
  //   console.log(inviteInput)
  //   const res = await AuthService.checkEmail(inviteInput)
  //   console.log(res)
  //   if (res) {
  //     const matchedUser =
  //       searchResults.find((u: any) => u.email === inviteInput.trim()) ||
  //       invited.find((u: any) => u.email === inviteInput.trim());
  //     console.log(matchedUser)
  //     if (matchedUser && !invited.find((u: any) => u.email === matchedUser.email)) {
  //       const res = await inviteUser({ email: inviteInput, workspaceUid: InviteType == 2 ? panelInvite?.id : InviteType == 1 ? createdWorkSpaceId?.id : null })
  //       res ? setInvited((prev) => [...prev, matchedUser]) : null
  //     } else {
  //       toast.warning("User already invited")
  //     }
  //     setInviteInput("");
  //     setSearchResults([]);
  //     setIsValidEmail(false);
  //   } else {
  //     toast.warning("User does not exist")
  //   }
  // };
  const handleInviteMember = async () => {
    debugger
    console.log(panelInvite)
    console.log(createdWorkSpaceId)
    console.log(searchResults)
    console.log(inviteInput, isValidEmail)
    // if (!inviteInput.trim() || !isValidEmail) return;
    const res = await AuthService.checkEmail(inviteInput)
    console.log(res)
    if (!res) {
      toast.warning(inviteInput + " does not exist")
    } else {
      const res = await inviteUser({ email: inviteInput, workspaceUid: InviteType == 2 ? panelInvite?.id : InviteType == 1 ? createdWorkSpaceId?.id : null })
      res ? [
        setInvited((prev) => [...prev, inviteInput]),
        toast.success("User Invited"),
        setInviteInput(""),
        setIsValidEmail(false)] : null
      console.log(invited)
      return invited

    }
    // const matchedUser =
    //   searchResults.find((u: any) => u.email === inviteInput.trim()) ||
    //   invited.find((u: any) => u.email === inviteInput.trim());
    // console.log(matchedUser)
    // if (matchedUser && !invited.find((u: any) => u.email === matchedUser.email)) {
    //   const res = await inviteUser({ email: inviteInput, workspaceUid: InviteType == 2 ? panelInvite?.id : InviteType == 1 ? createdWorkSpaceId?.id : null })
    //   res ? setInvited((prev) => [...prev, matchedUser]) : null
    // } else {
    //   toast.warning("User already invited")
    // }
    // setInviteInput("");
    // setSearchResults([]);
    // setIsValidEmail(false);
  };


  // API call on typing
  // API call on typing
  const handleInviteInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInviteInput(value);

    // if (value.trim()) {
    //   try {
    //     const res = await api.get(`/auth/searchAll?q=${value.trim()}`);
    //     const users =
    //       res?.data?.data?.userList?.map((s: any) => ({
    //         ...s,
    //         initials: initialsFrom(s.name),
    //       })) ?? [];
    //     setSearchResults(users);

    //     // check if typed value matches any email from results
    //     const match = users.some((u: any) => u.email === value.trim());
    //     console.log(match)
    //     setIsValidEmail(match);
    //   } catch (err) {
    //     console.error("Search API error:", err);
    //     setSearchResults([]);
    //     setIsValidEmail(false);
    //   }
    // } else {
    //   setSearchResults([]);
    //   setIsValidEmail(false);
    // }
  };


  // Add a user from search results to input (only email)
  const handleSelectUser = (user: any) => {
    setInviteInput(user.email);
    setIsValidEmail(true);
    // setSearchResults([]); // close the dropdown
  };


  return (
    <>
      {/* Collapsed pill */}
      {!isOpen && (
        <div
          className="absolute z-20 left-[100px] top-[24px] h-10 px-5 rounded-2xl flex items-center justify-between shadow-sm transition-all duration-500 ease-out"
          style={{ width: PANEL_WIDTH, height: 60, backgroundColor: "rgba(19,20,23,0.8)" }}
        >
          <span className="text-sm text-white/85 font-manrope select-none">Workspaces</span>
          <button
            onClick={() => toggle(true)}
            className="w-7 h-7 rounded-full border grid place-items-center hover:border-zinc-600 transition"
            style={{ borderColor: "#26272B" }}
          >
            <img src={maximiseIcon} alt="Expand" className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Panel */}
      <aside
        className="relative shrink-0 h-screen border-r border-[#26272B] bg-[#18181B] transition-[opacity] duration-500 flex flex-col"
        style={{
          width: isOpen ? PANEL_WIDTH + extraWidth : 0,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
        }}
      >
        {/* Resize handle */}
        {isOpen && (
          <button
            type="button"
            onMouseDown={(e) => {
              setDragging(true);
              dragStartX.current = e.clientX;
              dragStartExtra.current = extraWidth;
            }}
            className="absolute top-0 right-0 h-full w-1 sm:w-1 cursor-ew-resize"
            style={{ background: dragging ? "#3D93F8" : "transparent" }}
          />
        )}

        {/* Header */}
        <div className="px-3 pt-5 flex-shrink-0">
          <div className="h-8 flex items-center justify-between">
            <span className="text-white text-[16px] font-semibold tracking-[-0.01em]">
              Workspaces
            </span>
            <button
              onClick={() => toggle(false)}
              className="w-7 h-7 rounded-full border grid place-items-center hover:border-zinc-600 transition"
              style={{ borderColor: "#26272B" }}
            >
              <img src={minimiseIcon} alt="Collapse" className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Workspace list */}
        <div
          ref={listRef}
          onScroll={handleAnyScroll}
          className={[
            "flex-1 overflow-y-auto px-3 mt-6 space-y-2 chat-scroll",
            scrolling ? "scrolling" : "",
          ].join(" ")}
        >
          {workspaces?.map((ws) => (
            <WorkspaceTile
              key={ws.id}
              id={ws.id}
              name={ws.name}
              role={ws.role}
              initials={initialsFrom(ws.name)}
              active={activeId === ws.id}
              onTileClick={() => setActive(ws.id)}
              onOptionsClick={(args) => setOptionsFor(args)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="px-3 py-4 flex-shrink-0 border-t border-[#26272B] bg-[#18181B]">
          <button
            onClick={() => {
              setCreateOpen(true);
              setCreateStep(1);
            }}
            className="w-full h-10 rounded-2xl bg-[rgba(128,136,155,0.25)] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-white/20 transition-colors"
          >
            <svg viewBox="0 0 20 20" className="w-5 h-5">
              <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            New Workspace
          </button>
        </div>
      </aside>

      {/* Options flyout */}
      {optionsFor && (
        <div
          className="flex items-center justify-center absolute z-50 max-h-[100%] w-[204px] bg-[#18181B] border border-[#26272B] rounded-xl shadow-lg py-2"
          style={{
            top: optionsFor.anchorRect.top + 30,
            left: "305px",
          }}
        >
          <div className="w-[180px] max-h-[100%]">
            <button
              onClick={() => handleInvite(optionsFor.id, optionsFor.name)}
              className="rounded-[12px] w-full flex items-center gap-2 px-4 py-2 text-sm h-[40px] text-[#80889B] hover:bg-[#202024] hover:text-white"
            >
              <span><img src={addUserIcon} alt="Invite Members" className="w-[20px] h-[20px]" /></span> Invite Members
            </button>
            <button
              onClick={() => handleEdit(optionsFor.id, optionsFor.name)}
              className="rounded-[12px] w-full flex items-center gap-2 px-4 py-2 text-sm h-[40px] text-[#80889B] hover:bg-[#202024] hover:text-white"
            >
              <span><img src={editIcon} alt="Edit Space" className="w-[20px] h-[20px]" /></span> Edit Space
            </button>
            {optionsFor.role == WorkspaceRoleConstant.OWNER && <button
              onClick={() => handleDelete(optionsFor.id, optionsFor.name)}
              className="group rounded-[12px] w-full flex items-center gap-2 px-4 py-2 text-sm h-[40px] text-[#80889B] hover:bg-[#202024] hover:text-[#ED5C5B]"
            >
              <span><svg width="15" className="w-5 h-5 text-[#80889B] group-hover:text-[#ED5C5B]"
                height="15" viewBox="0 0 15 15" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 3H9C9 2.60218 8.84196 2.22064 8.56066 1.93934C8.27935 1.65804 7.89782 1.5 7.5 1.5C7.10218 1.5 6.72064 1.65804 6.43934 1.93934C6.15804 2.22064 6 2.60218 6 3ZM4.5 3C4.5 2.20435 4.81607 1.44129 5.37868 0.87868C5.94129 0.316071 6.70435 0 7.5 0C8.29565 0 9.05871 0.316071 9.62132 0.87868C10.1839 1.44129 10.5 2.20435 10.5 3H14.25C14.4489 3 14.6397 3.07902 14.7803 3.21967C14.921 3.36032 15 3.55109 15 3.75C15 3.94891 14.921 4.13968 14.7803 4.28033C14.6397 4.42098 14.4489 4.5 14.25 4.5H13.5885L12.924 12.255C12.8601 13.0038 12.5175 13.7014 11.9639 14.2098C11.4103 14.7181 10.6861 15.0001 9.9345 15H5.0655C4.31393 15.0001 3.58971 14.7181 3.03611 14.2098C2.48252 13.7014 2.13988 13.0038 2.076 12.255L1.4115 4.5H0.75C0.551088 4.5 0.360322 4.42098 0.21967 4.28033C0.0790176 4.13968 0 3.94891 0 3.75C0 3.55109 0.0790176 3.36032 0.21967 3.21967C0.360322 3.07902 0.551088 3 0.75 3H4.5ZM9.75 7.5C9.75 7.30109 9.67098 7.11032 9.53033 6.96967C9.38968 6.82902 9.19891 6.75 9 6.75C8.80109 6.75 8.61032 6.82902 8.46967 6.96967C8.32902 7.11032 8.25 7.30109 8.25 7.5V10.5C8.25 10.6989 8.32902 10.8897 8.46967 11.0303C8.61032 11.171 8.80109 11.25 9 11.25C9.19891 11.25 9.38968 11.171 9.53033 11.0303C9.67098 10.8897 9.75 10.6989 9.75 10.5V7.5ZM6 6.75C6.19891 6.75 6.38968 6.82902 6.53033 6.96967C6.67098 7.11032 6.75 7.30109 6.75 7.5V10.5C6.75 10.6989 6.67098 10.8897 6.53033 11.0303C6.38968 11.171 6.19891 11.25 6 11.25C5.80109 11.25 5.61032 11.171 5.46967 11.0303C5.32902 10.8897 5.25 10.6989 5.25 10.5V7.5C5.25 7.30109 5.32902 7.11032 5.46967 6.96967C5.61032 6.82902 5.80109 6.75 6 6.75ZM3.57 12.1275C3.60195 12.5021 3.77338 12.851 4.05033 13.1051C4.32729 13.3593 4.68959 13.5002 5.0655 13.5H9.9345C10.3102 13.4999 10.6721 13.3588 10.9487 13.1046C11.2254 12.8505 11.3966 12.5018 11.4285 12.1275L12.0825 4.5H2.9175L3.57 12.1275Z" fill="currentColor" />
              </svg>
              </span> Delete Space
            </button>}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/50">
          <div className="relative bg-[#18181B] rounded-2xl shadow-xl w-full max-w-sm p-6 transform -translate-y-20">
            {deleting && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center rounded-2xl">
                <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
              </div>
            )}
            <h2 className="text-white text-lg font-semibold mb-2">Delete {deleteTarget.name}</h2>
            <p className="text-[#80889B] text-sm mb-6">
              Are you sure you want to delete the workspace?
              This action is permanent and cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg w-[150px] h-[40px] bg-[#2A2B31] text-[#E6EAF0] hover:bg-[#33343A] transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg w-[150px] h-[40px] bg-[#3D93F8] text-white font-medium hover:bg-[#2F7BEF] transition disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Invite modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center backdrop-blur-md bg-black/50 pt-20">
          <div className={`
            relative bg-[#18181B] border border-[#26272B] rounded-2xl shadow-xl w-[544px] flex flex-col
            ${createStep === 1 ? "h-[590px]" : "min-h-[419px]"}
          `}>
            {(creating) && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center rounded-2xl">
                <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
              </div>
            )}

            {/* Step indicators */}


            {/* Step 1: Create New Space */}
            {(createStep === 1 || createStep === 3) && (
              <>
                <div className="flex gap-3 px-6 py-4 border-b border-[#26272B]">
                  <h2 className="text-white text-lg font-bold">{createStep == 1 ? "Create New Workspace" : "Edit Workspace"}</h2>
                </div>
                <div className="flex flex-col flex-1 px-10 py-10 gap-6">

                  <div className="flex flex-col gap-2 w-full">
                    <label className="text-white text-sm font-medium">Space Name *</label>
                    <input
                      type="text"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      className="w-full h-10 rounded-xl bg-[rgba(128,136,155,0.1)] border-2 border-[#26272B] px-3 text-white placeholder:text-[#80889B] outline-none focus:border-[#3D93F8] text-sm"
                      placeholder="Enter workspace name"
                    />
                  </div>
                  <div className="flex-1 rounded-xl border border-[#26272B] bg-[rgba(19,19,22,0.5)] flex items-center justify-center">
                    <img src={WorkspaceImg} alt="Meeting preview" className="rounded-xl  h-[290px]" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#26272B]">
                  <button
                    onClick={() => { setWorkspaceName(""); setCreateOpen(false); }}
                    disabled={creating}
                    className="px-6 py-2 text-sm rounded-[16px] w-[140px]  bg-[rgba(128,136,155,0.25)] text-white hover:bg-[#33343A] transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => createStep == 1 ? confirmCreateUpdate(1) : confirmCreateUpdate(2)}
                    disabled={!workspaceName.trim() || creating}
                    className={`px-6 py-2 rounded-[16px] text-sm transition ${workspaceName.trim()
                      ? "bg-[#3D93F8] text-white hover:bg-[#2F7BEF]"
                      : "bg-[rgba(128,136,155,0.8)] text-white/70 cursor-not-allowed"
                      }`}
                  >
                    {createStep == 1 ? "Create Workspace" : "Edit Workspace"}
                  </button>
                </div>
              </>
            )}

            {/* Step 2: Invite Team Members */}
            {createStep === 2 && (
              <>
                <div className="flex gap-3 px-6 py-4 border-b border-[#26272B]">
                  <h2 className="text-white text-lg font-bold">Invite Team Members</h2>
                </div>

                <div className="flex flex-col flex-1 px-10 py-5 gap-6">
                  <div className="flex items-center gap-3 h-[52px] px-4 bg-[#202024] rounded-xl mb-[10px]">
                    <div className="w-[28px] h-[28px] rounded-full bg-[#FFCAA9] text-[#212121] flex items-center justify-center text-sm font-semibold">
                      {panelInvite ? initialsFrom(panelInvite.name) : ""}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm">{panelInvite?.name}</span>
                    </div>
                  </div>
                  <div className="border-b border-[#26272B] mb-[10px]"></div>
                  {/* Search input */}
                  <div className="flex flex-col gap-2 relative">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={inviteInput}
                        onChange={handleInviteInputChange}
                        placeholder="Add members by name or email"
                        className="flex-1 h-10 rounded-xl bg-[rgba(128,136,155,0.1)] border border-[#26272B] px-3 text-white placeholder:text-[#80889B] outline-none focus:border-[#3D93F8] text-sm"
                      />
                      <button
                        onClick={handleInviteMember}
                        className={`px-4 py-2 rounded-[16px] w-[90px] h-[40px] text-sm ${inviteInput.trim()
                          ? "bg-[#3D93F8] text-white hover:bg-[#2F7BEF]"
                          : "bg-[#2A2B31] text-[#80889B] cursor-not-allowed"
                          }`}
                      >
                        Invite
                      </button>
                    </div>

                    {/* Search Results with the same scroll behavior */}
                    {searchResults.length > 0 && (
                      <div
                        onScroll={handleAnyScroll}
                        className={[
                          "absolute top-12 left-0 w-full bg-[#202024] border border-[#26272B] rounded-lg shadow-lg max-h-40 overflow-y-auto chat-scroll",
                          scrolling ? "scrolling" : "",
                        ].join(" ")}
                      >
                        {searchResults.map((user, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleSelectUser(user)}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-[#2A2B31] cursor-pointer"
                          >
                            <div className="w-8 h-8 rounded-full bg-[#3D93F8] text-white flex items-center justify-center text-sm font-semibold">
                              {user.initials}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-white text-sm">{user.name}</span>
                              <span className="text-[#80889B] text-xs">{user.email}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Copy link */}
                  <div>
                    <button className="text-[#3D93F8] flex text-sm hover:underline">
                      <img src={copyIcon} alt="Copy Invite Link" className="w-[20px] h-[20px]" />
                      <span className="ml-[5px]">Copy Invite Link</span>
                    </button>
                  </div>

                  {/* Invited list with the same scroll behavior */}
                  {invited.length > 0 && (
                    <div className="rounded-xl border border-[#26272B] bg-[#202024] p-4 space-y-2">
                      <h3 className="text-[#80889B] text-sm mb-2">{invited.length} Invited</h3>
                      <div
                        onScroll={handleAnyScroll}
                        className={[
                          "max-h-32 overflow-y-auto chat-scroll",
                          scrolling ? "scrolling" : "",
                        ].join(" ")}
                      >
                        {invited.map((user: any, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between mb-[15px] text-white text-sm py-1"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#5827DA] text-[#B69AFF] flex items-center justify-center text-sm font-semibold">
                                {user.initials || initialsFrom(user.name)}
                              </div>
                              <div className="flex flex-col">
                                <span>{user}</span>
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                setInvited(invited.filter((_: any, idx: number) => idx !== i))
                              }
                              className="text-red-500 hover:text-red-400"
                            >
                              <img src={deleteIcon} alt="Collapse" className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer buttons */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#26272B]">
                  <button
                    onClick={() => { setCreateOpen(false); setInvited([]); setSearchResults([]); setInviteInput("") }}
                    className="px-6 py-2 rounded-[16px] h-[40px] w-[150px] bg-[rgba(128,136,155,0.25)] text-white text-sm hover:bg-[#33343A] transition"
                  >
                    I’ll Do This Later
                  </button>
                  <button
                    onClick={() => { setCreateOpen(false); setInvited([]); setSearchResults([]); setInviteInput("") }}
                    className={`px-6 py-2 rounded-[16px] h-[40px] w-[150px]  bg-[#3D93F8] text-white text-sm hover:bg-[#2F7BEF] transition ${invited.length == 0 ? "cursor-not-allowed" : null}`}
                  >
                    Start Space
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default WorkspacePanel;
