/** @jsxImportSource react */
import React, { useState } from "react";

const InviteTeam: React.FC = () => {
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const shareLink =
    "https://nexspace.io/invite?user=loremipsumdolorsitamet"; // placeholder

  const handleInvite = () => {
    if (email.trim()) {
      setInvites((prev) => [...prev, email.trim()]);
      setEmail("");
    }
  };

  const handleRemove = (index: number) => {
    setInvites((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  const visibleInvites = showAll ? invites : invites.slice(0, 3);
  const remainingCount = invites.length - 3;

  return (
    <div className="bg-[#18181B] rounded-2xl p-6 w-[544px] text-white">
      {/* Title */}
      <h2 className="text-lg font-bold mb-6">Invite Team</h2>

      {/* Email Input */}
      <div className="flex items-end gap-3 mb-6">
        <div className="flex flex-col flex-1 gap-2">
          <label className="text-sm font-medium">Email *</label>
          <input
            type="email"
            placeholder="Enter email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-10 px-4 rounded-xl border-2 border-[#26272B] bg-[rgba(128,136,155,0.1)] focus:outline-none"
          />
        </div>
        <button
          disabled={!email}
          onClick={handleInvite}
          className={`h-10 px-4 rounded-xl font-medium transition-colors ${email
            ? "bg-[#4285F4] text-white"
            : "bg-[rgba(128,136,155,0.8)] opacity-50 cursor-not-allowed"
            }`}
        >
          Invite
        </button>
      </div>

      {/* Invited List */}
      {invites.length > 0 && (
        <div className="bg-[rgba(128,136,155,0.05)] rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold mb-4">{invites.length} Invited</p>
          <div className="flex flex-col gap-3">
            {visibleInvites.map((inv, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-transparent"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[rgba(88,39,218,0.25)] flex items-center justify-center text-xs font-medium text-[#B69AFF]">
                    {inv[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm">{inv}</span>
                </div>
                <button
                  onClick={() => handleRemove(idx)}
                  className="w-8 h-8 flex items-center justify-center bg-[#202024] rounded-full hover:bg-red-500 transition"
                >
                  <span className="text-xs text-gray-400">✕</span>
                </button>
              </div>
            ))}

            {remainingCount > 0 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-sm text-gray-400 underline self-start"
              >
                {showAll ? "Show Less" : `Show ${remainingCount} More`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Share Link */}
      <div className="flex items-end gap-3 mb-6">
        <div className="flex flex-col flex-1 gap-2">
          <label className="text-sm font-medium">Share Link</label>
          <div className="flex items-center h-10 px-4 rounded-xl border-2 border-[#26272B] bg-[rgba(128,136,155,0.1)]">
            <span className="truncate text-sm">{shareLink}</span>
          </div>
        </div>
        <button
          onClick={handleCopy}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-[rgba(128,136,155,0.25)]"
        >
          📋
        </button>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center mt-4">
        <button className="px-4 py-2 rounded-xl bg-[rgba(128,136,155,0.25)] font-medium">
          I’ll do this later
        </button>
        <button
          disabled={invites.length === 0}
          className={`px-6 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 ${invites.length > 0
            ? "bg-[#4285F4] text-white"
            : "bg-[rgba(128,136,155,0.25)] opacity-50 cursor-not-allowed"
            }`}
        >
          Continue to NexSpace →
        </button>
      </div>

      {/* Copy Feedback */}
      {copied && (
        <p className="text-xs text-green-400 mt-2">Copied to clipboard!</p>
      )}
    </div>
  );
};

export default InviteTeam;
