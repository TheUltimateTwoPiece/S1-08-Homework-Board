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
    <div className="w-full max-w-md animate-[hb-fade-in_400ms_ease-out]">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 via-white to-red-50 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-slate-700">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 19.5" />
              <path d="M9 10h6" />
              <path d="M9 14h6" />
              <path d="M9 6h6" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">S1-08 Homework Board</h1>
          <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-300">
            {mode === "signin"
              ? "Sign in to view homework and notifications"
              : "Create an account to join your class"}
          </p>
        </div>

        <div className="mb-6 flex rounded-lg bg-slate-100/70 p-1">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              mode === "signin"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-700 dark:text-slate-300 hover:text-slate-700"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              mode === "signup"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-700 dark:text-slate-300 hover:text-slate-700"
            }`}
          >
            Sign up
          </button>
        </div>

        {mode === "signin" ? (
          <form action={signInAction} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
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
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
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
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
            )}
            <button
              type="submit"
              disabled={pending}
              className={`hb-btn-primary w-full gap-2 py-2.5 text-sm font-medium ${
                pending ? "hb-btn--pending" : ""
              }`}
            >
              {pending && <span className="hb-spinner" aria-hidden="true" />}
              {pending ? "Signing in..." : "Sign in"}
            </button>
          </form>
        ) : (
          <form action={signUpAction} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
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
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                <label htmlFor="adminCode" className="mb-1.5 block text-sm font-medium text-amber-800">
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
                <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-700">
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
              <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-slate-700">
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
              <label htmlFor="signup-email" className="mb-1.5 block text-sm font-medium text-slate-700">
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
              <label htmlFor="signup-password" className="mb-1.5 block text-sm font-medium text-slate-700">
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
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
            )}
            {success && (
              <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600">
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
              className={`hb-btn-primary w-full gap-2 py-2.5 text-sm font-medium ${
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
