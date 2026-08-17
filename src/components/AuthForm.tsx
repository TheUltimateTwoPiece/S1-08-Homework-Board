"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, resetPassword } from "@/actions/auth";

type AuthMode = "signin" | "signup" | "reset";
type AccountType = "student" | "admin";

type AuthFormProps = {
  initialMode?: AuthMode;
};

/** Sign-in form with "Forgot password?" link. */
function SignInForm({
  error,
  pending,
  action,
  onResetClick,
}: {
  error: string | undefined;
  pending: boolean;
  action: (payload: FormData) => void;
  onResetClick: () => void;
}) {
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="hb-card-section mb-1.5 block text-sm">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="hb-input w-full rounded-lg px-3 py-2.5 text-sm"
        />
      </div>
      <div>
        <label htmlFor="password" className="hb-card-section mb-1.5 block text-sm">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Enter your password"
          className="hb-input w-full rounded-lg px-3 py-2.5 text-sm"
        />
      </div>
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-300">{error}</div>
      )}
      <div className="flex flex-col gap-3">
        <button
          type="submit"
          disabled={pending}
          className={`button w-full gap-2 ${
            pending ? "hb-btn--pending" : ""
          }`}
        >
          {pending && <span className="hb-spinner" aria-hidden="true" />}
          {pending ? "Signing in..." : "Sign in"}
        </button>
        <button
          type="button"
          onClick={onResetClick}
          className="hb-link-muted text-center text-sm underline-offset-2 hover:underline"
        >
          Forgot password?
        </button>
      </div>
    </form>
  );
}

/** Inline "Forgot password" form — enter email, get a reset link. */
function ResetPasswordForm({ onBack }: { onBack: () => void }) {
  const [state, action, pending] = useActionState(
    async (_prev: { error?: string; success?: string } | null, formData: FormData): Promise<{ error?: string; success?: string } | null> => {
      const result = await resetPassword(formData);
      return result ?? null;
    },
    null,
  );

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="reset-email" className="hb-card-section mb-1.5 block text-sm">
          Email address
        </label>
        <input
          id="reset-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="hb-input w-full rounded-lg px-3 py-2.5 text-sm"
        />
      </div>
      {state?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-300" role="alert">
          {state.error}
        </div>
      )}
      {state?.success ? (
        <>
          <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600 dark:bg-green-950/50 dark:text-green-300">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {state.success}
            </div>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="hb-link-muted w-full text-center text-sm underline-offset-2 hover:underline"
          >
            Back to sign in
          </button>
        </>
      ) : (
        <>
          <button
            type="submit"
            disabled={pending}
            className={`button w-full gap-2 ${
              pending ? "hb-btn--pending" : ""
            }`}
          >
            {pending && <span className="hb-spinner" aria-hidden="true" />}
            {pending ? "Sending..." : "Send reset link"}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="hb-link-muted w-full text-center text-sm underline-offset-2 hover:underline"
          >
            Back to sign in
          </button>
        </>
      )}
    </form>
  );
}

export function AuthForm({ initialMode = "signin" }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [accountType, setAccountType] = useState<AccountType>("student");

  const [signInState, signInAction, signInPending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      return signIn(formData);
    },
    null,
  );

  const [signUpState, signUpAction, signUpPending] = useActionState(
    async (_prev: { error?: string; success?: string } | null, formData: FormData) => {
      return signUp(formData);
    },
    null,
  );

  const error = mode === "signin" ? signInState?.error : signUpState?.error;
  const success = mode === "signup" ? signUpState?.success : undefined;
  const pending = mode === "signin" ? signInPending : signUpPending;

  const showTabBar = mode === "signin" || mode === "signup";

  return (
    <div className="w-full max-w-md animate-[hb-fade-in_400ms_ease-out]">
      <div className="hb-card-surface p-8">
        <div className="mb-6">
          <h1 className="hb-page-title text-2xl">S1-08 Homework Board</h1>
          <p className="hb-body-text mt-1 text-sm">
            {mode === "signin"
              ? "Sign in to view your homework and notifications."
              : mode === "reset"
                ? "Enter your email and we'll send a reset link."
                : "Create an account to join your class."}
          </p>
        </div>

        {showTabBar && (
          <div className="mb-6 flex border border-[var(--hb-border)]">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                mode === "signin"
                  ? "hb-segmented-btn--active"
                  : "hb-segmented-btn--inactive"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                mode === "signup"
                  ? "hb-segmented-btn--active"
                  : "hb-segmented-btn--inactive"
              }`}
            >
              Sign up
            </button>
          </div>
        )}

        {mode === "signin" ? (
          <SignInForm
            error={error}
            pending={pending}
            action={signInAction}
            onResetClick={() => setMode("reset")}
          />
        ) : mode === "reset" ? (
          <ResetPasswordForm onBack={() => setMode("signin")} />
        ) : (
          <form action={signUpAction} className="space-y-4">
            <div>
              <label className="hb-card-section mb-2 block text-sm">
                Account type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAccountType("student")}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                    accountType === "student"
                      ? "hb-choice-btn--active"
                      : "hb-choice-btn--inactive"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                      <path d="M6 12v5c3 3 9 3 12 0v-5" />
                    </svg>
                    Student
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType("admin")}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                    accountType === "admin"
                      ? "hb-choice-btn--active"
                      : "hb-choice-btn--inactive"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                    </svg>
                    Admin
                  </div>
                </button>
              </div>
              <input type="hidden" name="accountType" value={accountType} />
            </div>

            {accountType === "admin" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-700/50 dark:bg-amber-900/20">
                <label htmlFor="adminCode" className="mb-1.5 block text-sm font-medium text-amber-800 dark:text-amber-200">
                  Admin access code
                </label>
                <input
                  id="adminCode"
                  name="adminCode"
                  type="text"
                  required
                  maxLength={16}
                  placeholder="16-character code"
                  autoComplete="off"
                  spellCheck={false}
                  className="hb-input w-full rounded-lg px-3 py-2.5 font-mono text-sm uppercase tracking-widest"
                />
                <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                  Ask an admin for the access code
                </p>
              </div>
            )}

            <div>
              <label htmlFor="fullName" className="hb-card-section mb-1.5 block text-sm">
                Full name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                autoComplete="name"
                placeholder="Your full name"
                className="hb-input w-full rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="signup-email" className="hb-card-section mb-1.5 block text-sm">
                Email
              </label>
              <input
                id="signup-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="hb-input w-full rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="signup-password" className="hb-card-section mb-1.5 block text-sm">
                Password
              </label>
              <input
                id="signup-password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="At least 6 characters"
                className="hb-input w-full rounded-lg px-3 py-2.5 text-sm"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-300">{error}</div>
            )}
            {success && (
              <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600 dark:bg-green-950/50 dark:text-green-300">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {success}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className={`button w-full gap-2 ${
                pending ? "hb-btn--pending" : ""
              }`}
            >
              {pending && <span className="hb-spinner" aria-hidden="true" />}
              {pending
                ? "Creating account..."
                : accountType === "admin"
                  ? "Create admin account"
                  : "Create student account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
