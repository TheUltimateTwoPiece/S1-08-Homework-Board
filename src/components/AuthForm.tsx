"use client";

import { useActionState, useState } from "react";
import { signIn, signUp } from "@/actions/auth";

type AuthMode = "signin" | "signup";
type AccountType = "student" | "admin";

type AuthFormProps = {
  initialMode?: AuthMode;
};

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

  return (
    <div className="hb-card w-full max-w-md p-8">
      <h1 className="hb-text text-2xl font-bold">S1-08 Homework Board</h1>
      <p className="hb-text-muted mt-1 text-sm">
        {mode === "signin"
          ? "Sign in to view homework and notifications"
          : "Create an account to join your class"}
      </p>

      <div className="hb-segmented mt-6 flex rounded-lg p-1">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
            mode === "signin"
              ? "hb-segmented-btn--active"
              : "hb-segmented-btn--inactive hover:text-slate-900"
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
              : "hb-segmented-btn--inactive hover:text-slate-900"
          }`}
        >
          Sign up
        </button>
      </div>

      {mode === "signin" ? (
        <form action={signInAction} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="hb-text-muted mb-1 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="hb-input w-full rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="password" className="hb-text-muted mb-1 block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="hb-input w-full rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="hb-text-error text-sm">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className={`hb-btn-primary flex w-full items-center justify-center gap-2 py-2.5 text-sm font-medium ${
              pending ? "hb-btn--pending" : ""
            }`}
          >
            {pending && <span className="hb-spinner" aria-hidden="true" />}
            {pending ? "Signing in..." : "Sign in"}
          </button>
        </form>
      ) : (
        <form action={signUpAction} className="mt-6 space-y-4">
          <div>
            <label className="hb-text-muted mb-2 block text-sm font-medium">
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
                Student
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
                Admin
              </button>
            </div>
            <input type="hidden" name="accountType" value={accountType} />
          </div>

          {accountType === "admin" && (
            <div>
              <label htmlFor="adminCode" className="hb-text-muted mb-1 block text-sm font-medium">
                Admin access code
              </label>
              <input
                id="adminCode"
                name="adminCode"
                type="text"
                required
                maxLength={16}
                placeholder="16-character code from your admin"
                autoComplete="off"
                spellCheck={false}
                className="hb-input w-full rounded-lg px-3 py-2 font-mono text-sm uppercase tracking-wider"
              />
              <p className="hb-text-subtle mt-1 text-xs">
                Ask an admin for the access code.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="fullName" className="hb-text-muted mb-1 block text-sm font-medium">
              Full name
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              autoComplete="name"
              className="hb-input w-full rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="signup-email" className="hb-text-muted mb-1 block text-sm font-medium">
              Email
            </label>
            <input
              id="signup-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="hb-input w-full rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="signup-password" className="hb-text-muted mb-1 block text-sm font-medium">
              Password
            </label>
            <input
              id="signup-password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="hb-input w-full rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="hb-text-error text-sm">{error}</p>}
          {success && <p className="hb-text-success text-sm">{success}</p>}

          <button
            type="submit"
            disabled={pending}
            className={`hb-btn-primary flex w-full items-center justify-center gap-2 py-2.5 text-sm font-medium ${
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
  );
}
