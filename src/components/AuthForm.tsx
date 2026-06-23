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
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">S1-08 Homework Board</h1>
      <p className="mt-1 text-sm text-slate-600">
        {mode === "signin"
          ? "Sign in to view homework and notifications"
          : "Create an account to join your class"}
      </p>

      <div className="mt-6 flex rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
            mode === "signin"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
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
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Sign up
        </button>
      </div>

      {mode === "signin" ? (
        <form action={signInAction} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {pending ? "Signing in..." : "Sign in"}
          </button>
        </form>
      ) : (
        <form action={signUpAction} className="mt-6 space-y-4">
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
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                    : "border-slate-300 text-slate-700 hover:border-slate-400"
                }`}
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => setAccountType("admin")}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                  accountType === "admin"
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                    : "border-slate-300 text-slate-700 hover:border-slate-400"
                }`}
              >
                Admin
              </button>
            </div>
            <input type="hidden" name="accountType" value={accountType} />
          </div>

          {accountType === "admin" && (
            <div>
              <label htmlFor="adminCode" className="mb-1 block text-sm font-medium text-slate-700">
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm uppercase tracking-wider focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <p className="mt-1 text-xs text-slate-500">
                Ask an admin for the access code.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-slate-700">
              Full name
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              autoComplete="name"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div>
            <label htmlFor="signup-email" className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="signup-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div>
            <label htmlFor="signup-password" className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="signup-password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-700">{success}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
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
