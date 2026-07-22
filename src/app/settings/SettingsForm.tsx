"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import {
  updateProfile,
  type UpdateProfileResult,
} from "@/actions/profile";
import { Avatar } from "@/components/Avatar";
import { PendingButton } from "@/components/PendingButton";
import type { Profile } from "@/lib/types";

type SettingsFormProps = {
  profile: Profile;
};

const INITIAL_STATE: UpdateProfileResult | null = null;

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function SettingsForm({ profile }: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(
    async (
      _prev: UpdateProfileResult | null,
      formData: FormData,
    ): Promise<UpdateProfileResult> => updateProfile(formData),
    INITIAL_STATE,
  );

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeRequested, setRemoveRequested] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const error = state && !state.success ? state.error : null;
  const success = state && state.success;

  // Single source of truth for "submit is blocked" — used by both the HTML
  // `disabled` attribute (which blocks click + Enter natively) and the
  // `aria-disabled` attribute (which screen readers announce). Keeping them
  // in sync from one variable prevents the two from drifting.
  const blocked = pending || clientError !== null;

  const activeAvatarUrl =
    removeRequested || !profile.avatar_url
      ? null
      : previewUrl ?? profile.avatar_url;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setClientError(null);
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    if (!ACCEPTED_TYPES.has(file.type)) {
      setClientError("Avatar must be a JPG, PNG, WebP, or GIF image.");
      e.target.value = "";
      setPreviewUrl(null);
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setClientError(
        `Avatar is too large (${Math.round(file.size / 1024)} KB). Max 2 MB.`,
      );
      e.target.value = "";
      setPreviewUrl(null);
      return;
    }
    setRemoveRequested(false);
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleRemove() {
    setPreviewUrl(null);
    setRemoveRequested(true);
    setClientError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleCancelRemove() {
    setRemoveRequested(false);
    setClientError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <form
      action={formAction}
      aria-busy={pending}
      className="hb-card-surface space-y-8 p-6 sm:p-8"
    >
      {/* ── Avatar ─────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <div className="hb-bento-icon-box" aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h2 className="hb-card-section text-base">Profile picture</h2>
        </div>

        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <Avatar
            id={profile.id}
            name={profile.full_name}
            src={activeAvatarUrl}
            size="xl"
            className="ring-1 ring-slate-200"
          />

          <div className="flex-1 space-y-3">
            <p className="hb-card-meta text-sm">
              Square images work best. JPG, PNG, WebP, or GIF up to 2&nbsp;MB.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              name="avatar"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
              disabled={pending}
              className="block w-full max-w-sm text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-60"
            />
            <input
              type="hidden"
              name="removeAvatar"
              value={removeRequested ? "true" : "false"}
            />
            <div className="flex flex-wrap gap-2">
              {removeRequested ? (
                <button
                  type="button"
                  onClick={handleCancelRemove}
                  disabled={pending}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel remove
                </button>
              ) : profile.avatar_url || previewUrl ? (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={pending}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                >
                  Remove picture
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ── Display name ───────────────────────── */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <div className="hb-bento-icon-box" aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
          </div>
          <h2 className="hb-card-section text-base">Display name</h2>
        </div>
        <label
          htmlFor="fullName"
          className="hb-card-section mb-1.5 block text-sm"
        >
          How your name appears on posts, comments, and feedback
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          maxLength={80}
          defaultValue={profile.full_name}
          autoComplete="name"
          disabled={pending}
          className="hb-input w-full max-w-md rounded-lg px-3 py-2.5 text-sm disabled:opacity-60"
          placeholder="Your display name"
        />
      </section>

      {/* ── Email notifications ─────────────────── */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <div className="hb-bento-icon-box" aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <h2 className="hb-card-section text-base">Email notifications</h2>
        </div>
        <p className="hb-card-meta mb-4 text-sm">
          Pick which class emails you want to receive. In-app bell notifications are unaffected — you&apos;ll still see new homework and reminders in the app regardless of these settings.
        </p>

        <div className="space-y-3">
          <label
            htmlFor="emailPostNotifications"
            className={`flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 transition ${
              pending
                ? "cursor-not-allowed opacity-60"
                : "cursor-pointer hover:bg-slate-50"
            }`}
          >
            <input
              id="emailPostNotifications"
              name="emailPostNotifications"
              type="checkbox"
              defaultChecked={profile.email_post_notifications ?? true}
              disabled={pending}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="hb-card-section text-sm font-semibold">
                Email me when new homework is posted
              </div>
              <div className="hb-card-meta mt-0.5 text-xs">
                Get a transactional email each time your teacher publishes a new assignment.
              </div>
            </div>
          </label>

          <label
            htmlFor="emailReminderNotifications"
            className={`flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 transition ${
              pending
                ? "cursor-not-allowed opacity-60"
                : "cursor-pointer hover:bg-slate-50"
            }`}
          >
            <input
              id="emailReminderNotifications"
              name="emailReminderNotifications"
              type="checkbox"
              defaultChecked={profile.email_reminder_notifications ?? true}
              disabled={pending}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="hb-card-section text-sm font-semibold">
                Email me when reminders are sent
              </div>
              <div className="hb-card-meta mt-0.5 text-xs">
                Get a transactional email when your teacher sends an ad-hoc reminder to you, your class, or anyone still missing a specific assignment.
              </div>
            </div>
          </label>
        </div>
      </section>

      {/* ── Account (read-only) ────────────────── */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <div className="hb-bento-icon-box" aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 className="hb-card-section text-base">Account</h2>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="hb-card-meta text-xs uppercase tracking-wider">
              Email
            </dt>
            <dd className="hb-card-body mt-0.5 text-sm">{profile.email}</dd>
          </div>
          <div>
            <dt className="hb-card-meta text-xs uppercase tracking-wider">
              Role
            </dt>
            <dd className="hb-card-body mt-0.5 text-sm capitalize">
              {profile.role}
            </dd>
          </div>
        </dl>
      </section>

      {/* ── Footer ─────────────────────────────── */}
      {clientError && (
        <div
          role="alert"
          className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {clientError}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          Profile saved. Your new picture and name are now visible everywhere
          you post, comment, or send feedback.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6">
        <Link
          href="/"
          className="text-sm font-medium text-slate-700 transition hover:text-slate-900"
        >
          ← Back to home
        </Link>
        <PendingButton
          type="submit"
          pendingContent="Saving..."
          disabled={blocked}
          aria-disabled={blocked}
          className="hb-btn-primary gap-2 px-4 py-2 text-sm font-medium"
        >
          Save changes
        </PendingButton>
      </div>
    </form>
  );
}
