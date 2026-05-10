"use client";

import { useEffect, useState } from "react";
import { Mail, Send, X, AlertCircle, Loader2 } from "lucide-react";
import { api, ApiError } from "@/app/lib/api";

interface ApproveModalProps {
  reportId: string;
  studentName: string;
  open: boolean;
  onClose: () => void;
  onApproved: (info: { recipient: string }) => void;
  showTeacherNote?: boolean;
  /** Custom title shown at the top of the card. */
  title?: string;
  /** Custom subtitle below the title. */
  subtitle?: string;
  /** Custom label for the confirm button (default "Send Report"). */
  confirmLabel?: string;
  /**
   * If provided, replaces the default `api.reports.approve` call. Receives
   * the chosen recipient email and the (trimmed) teacher note (when shown).
   * The modal still resolves `onApproved` with the recipient on success.
   */
  onConfirm?: (recipientEmail: string, teacherNote: string) => Promise<void>;
}

type Choice = "on_record" | "custom";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ApproveModal({
  reportId,
  studentName,
  open,
  onClose,
  onApproved,
  showTeacherNote = true,
  title = "Approve Report",
  subtitle,
  confirmLabel = "Send Report",
  onConfirm,
}: ApproveModalProps) {
  const [parentEmail, setParentEmail] = useState<string | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [choice, setChoice] = useState<Choice>("on_record");
  const [customEmail, setCustomEmail] = useState("");
  const [teacherNote, setTeacherNote] = useState("");
  const [delivering, setDelivering] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset + fetch when modal opens
  useEffect(() => {
    if (!open) return;
    setChoice("on_record");
    setCustomEmail("");
    setTeacherNote("");
    setSubmitError(null);
    setParentEmail(null);
    setEmailError(null);
    setLoadingEmail(true);
    api.reports
      .parentEmail(reportId)
      .then((res) => {
        setParentEmail(res.parent_email);
        // Force custom branch when no email on record
        if (!res.parent_email) setChoice("custom");
      })
      .catch((e) => {
        setEmailError(e instanceof Error ? e.message : "Failed to load parent email");
        setChoice("custom");
      })
      .finally(() => setLoadingEmail(false));
  }, [open, reportId]);

  if (!open) return null;

  const firstName = studentName.split(" ")[0] ?? studentName;
  const noEmailOnRecord = !loadingEmail && !parentEmail;
  const customTrimmed = customEmail.trim();
  const customValid = EMAIL_RE.test(customTrimmed);
  const canSubmit =
    !delivering &&
    !loadingEmail &&
    (choice === "on_record" ? !!parentEmail : customValid);

  async function handleApprove() {
    setSubmitError(null);
    const recipient = choice === "custom" ? customTrimmed : parentEmail || "";
    if (!recipient) {
      setSubmitError("Please enter a recipient email.");
      return;
    }
    setDelivering(true);
    try {
      if (onConfirm) {
        await onConfirm(recipient, teacherNote.trim());
      } else {
        await api.reports.approve(
          reportId,
          teacherNote.trim() || undefined,
          choice === "custom" ? customTrimmed : undefined,
        );
      }
      onApproved({ recipient });
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.detail || e.message
          : e instanceof Error
            ? e.message
            : "Failed to approve report";
      setSubmitError(msg);
    } finally {
      setDelivering(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[var(--ss-i-900)]/40 backdrop-blur-sm"
        onClick={delivering ? undefined : onClose}
      />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-[var(--ss-shadow-lg)] p-6">
        <button
          onClick={onClose}
          disabled={delivering}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-[var(--ss-i-100)] transition-colors disabled:opacity-50"
          aria-label="Close"
        >
          <X size={17} className="text-[var(--ss-i-400)]" />
        </button>
        <h2
          className="text-lg font-bold text-[var(--ss-i-900)] mb-1"
          style={{ fontFamily: "var(--font-jakarta)" }}
        >
          {title}
        </h2>
        <p className="text-sm text-[var(--ss-i-400)] mb-5">
          {subtitle ?? `Confirm where to deliver ${firstName}'s report.`}
        </p>

        {/* ── Recipient card ── */}
        <div className="rounded-2xl border border-[var(--ss-i-200)] p-4 mb-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--ss-i-500)] mb-3">
            <Mail size={13} />
            Send report to
          </div>

          {loadingEmail ? (
            <div className="flex items-center gap-2 text-sm text-[var(--ss-i-400)] py-2">
              <Loader2 size={14} className="animate-spin" />
              Loading email on record…
            </div>
          ) : (
            <div className="space-y-2">
              {/* On-record option */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  choice === "on_record"
                    ? "border-[var(--ss-o-400)] bg-[var(--ss-o-50)]"
                    : "border-[var(--ss-i-200)] hover:bg-[var(--ss-i-100)]"
                } ${noEmailOnRecord ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <input
                  type="radio"
                  name="recipient"
                  value="on_record"
                  checked={choice === "on_record"}
                  disabled={noEmailOnRecord}
                  onChange={() => setChoice("on_record")}
                  className="mt-0.5 accent-[var(--ss-o-500)]"
                />
                <div className="flex-1 min-w-0">
                  {parentEmail ? (
                    <>
                      <div className="text-sm font-semibold text-[var(--ss-i-900)] truncate">
                        {parentEmail}
                      </div>
                      <div className="text-xs text-[var(--ss-i-500)]">On record in Wise</div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-semibold text-[var(--ss-i-500)]">
                        No email on record
                      </div>
                      <div className="text-xs text-[var(--ss-i-400)]">
                        Wise has no parent email for {firstName}.
                      </div>
                    </>
                  )}
                </div>
              </label>

              {/* Custom option */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  choice === "custom"
                    ? "border-[var(--ss-o-400)] bg-[var(--ss-o-50)]"
                    : "border-[var(--ss-i-200)] hover:bg-[var(--ss-i-100)]"
                }`}
              >
                <input
                  type="radio"
                  name="recipient"
                  value="custom"
                  checked={choice === "custom"}
                  onChange={() => setChoice("custom")}
                  className="mt-0.5 accent-[var(--ss-o-500)]"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--ss-i-900)]">
                    Custom email
                  </div>
                  <div className="text-xs text-[var(--ss-i-500)]">
                    Send to a different address (won&apos;t update the Wise record).
                  </div>
                  {choice === "custom" && (
                    <input
                      type="email"
                      autoFocus
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      placeholder="parent@example.com"
                      className="mt-2 w-full px-3 py-2 rounded-lg border border-[var(--ss-i-200)] bg-white text-sm text-[var(--ss-i-700)] placeholder:text-[var(--ss-i-300)] focus:outline-none focus:ring-2 focus:ring-[var(--ss-o-300)] focus:border-[var(--ss-o-400)]"
                    />
                  )}
                  {choice === "custom" && customTrimmed && !customValid && (
                    <p className="mt-1 text-xs text-[var(--ss-error)]">
                      That doesn&apos;t look like a valid email address.
                    </p>
                  )}
                </div>
              </label>
            </div>
          )}

          {emailError && !loadingEmail && (
            <p className="mt-3 text-xs text-[var(--ss-error)] flex items-start gap-1.5">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              {emailError}
            </p>
          )}
        </div>

        {showTeacherNote && (
          <textarea
            value={teacherNote}
            onChange={(e) => setTeacherNote(e.target.value)}
            placeholder={`Optional note for ${firstName}'s parents…`}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-[var(--ss-i-200)] bg-white text-sm text-[var(--ss-i-700)] placeholder:text-[var(--ss-i-300)] focus:outline-none focus:ring-2 focus:ring-[var(--ss-o-300)] focus:border-[var(--ss-o-400)] resize-none transition mb-4"
          />
        )}

        {submitError && (
          <p className="mb-3 text-xs text-[var(--ss-error)] flex items-start gap-1.5">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            {submitError}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleApprove}
            disabled={!canSubmit}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full bg-[var(--ss-o-500)] text-white text-sm font-semibold hover:bg-[var(--ss-o-600)] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-[var(--ss-shadow-brand)]"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            {delivering ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send size={14} />
                {confirmLabel}
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={delivering}
            className="px-4 py-2.5 text-sm text-[var(--ss-i-500)] hover:text-[var(--ss-i-700)] font-medium disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
