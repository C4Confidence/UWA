"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LogOut,
  UserRound,
} from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useStore } from "./store-provider";
import type { Account } from "@/lib/types";

function readAccount(value: unknown): Account | null {
  if (!value || typeof value !== "object") return null;
  const user = value as Record<string, unknown>;
  if (
    typeof user._id !== "string" ||
    !/^[a-f\d]{24}$/i.test(user._id) ||
    typeof user.firstname !== "string" ||
    typeof user.lastname !== "string" ||
    typeof user.email !== "string" ||
    typeof user.token !== "string" ||
    !user.token
  )
    return null;
  return {
    _id: user._id,
    firstname: user.firstname,
    lastname: user.lastname,
    email: user.email,
    token: user.token,
  };
}

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const registering = mode === "signup";
  const { account, ready, signIn } = useStore();
  const router = useRouter();
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !ready) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get("password") || "");
    if (registering && password !== String(values.get("confirmation") || "")) {
      setError("Your passwords don’t match. Please try again.");
      form.querySelector<HTMLInputElement>("#confirmation")?.focus();
      return;
    }
    const email = String(values.get("email") || "").trim();
    const firstname = String(values.get("firstname") || "").trim();
    const lastname = String(values.get("lastname") || "").trim();
    const mobile = String(values.get("mobile") || "").trim();
    if (registering && (!firstname || !lastname)) {
      setError("Please enter your first and last name.");
      return;
    }
    if (
      registering &&
      (!/^\+?[\d\s().-]{7,30}$/.test(mobile) ||
        mobile.replace(/\D/g, "").length < 7)
    ) {
      setError(
        "Please enter a valid mobile number, including your country code.",
      );
      form.querySelector<HTMLInputElement>("#mobile")?.focus();
      return;
    }
    setError("");
    setBusy(true);
    submitting.current = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(
        `/api/user/${registering ? "register" : "login"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          signal: controller.signal,
          body: JSON.stringify(
            registering
              ? { firstname, lastname, email, mobile, password }
              : { email, password },
          ),
        },
      );
      if (!response.ok) {
        let message = "";
        try {
          const body: unknown = await response.json();
          if (
            body &&
            typeof body === "object" &&
            "message" in body &&
            typeof body.message === "string"
          )
            message = body.message;
        } catch {
          /* A proxy error may not be JSON. Never display its response body. */
        }
        if (
          !registering &&
          (message === "Invalid Credentials" || response.status === 401)
        ) {
          setError(
            "That email and password don’t match. Check your details and try again.",
          );
        } else if (
          registering &&
          (message === "User Already Exists" ||
            message.includes("E11000 duplicate key"))
        ) {
          setError(
            "An account already uses these details. Please sign in or use different account details.",
          );
        } else if (response.status === 429) {
          setError(
            "Too many attempts. Please wait a moment before trying again.",
          );
        } else {
          setError(
            registering
              ? "We couldn’t create your account. Please try again later."
              : "Sign in is temporarily unavailable. Please try again later.",
          );
        }
        return;
      }
      if (registering) {
        // Registration returns a full user document. Do not parse or retain it.
        await response.body?.cancel();
        form.reset();
        setSuccess(true);
        return;
      }
      const data: unknown = await response.json();
      const user = readAccount(data);
      if (!user) {
        setError("We couldn’t verify your sign in. Please try again later.");
        return;
      }
      signIn(user);
      router.replace("/account");
    } catch {
      setError(
        controller.signal.aborted
          ? "The request took too long. Check your connection and try again."
          : "We couldn’t connect. Please check your connection and try again.",
      );
    } finally {
      clearTimeout(timeout);
      submitting.current = false;
      setBusy(false);
    }
  }

  if (success)
    return (
      <div className="form-success" role="status">
        <CheckCircle2 size={38} strokeWidth={1.4} aria-hidden="true" />
        <p className="eyebrow">You’re all set</p>
        <h2>Your account is ready.</h2>
        <p className="muted">
          Welcome to UWA. Sign in with your email and password to get started.
        </p>
        <Link className="button button-dark" href="/signin">
          Sign in <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    );

  if (ready && account)
    return (
      <div className="form-success">
        <UserRound size={38} strokeWidth={1.4} aria-hidden="true" />
        <h2>You’re already signed in.</h2>
        <p className="muted">
          Welcome back, {account.firstname}. Your next find is waiting.
        </p>
        <Link className="button button-dark" href="/account">
          Go to your account <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    );

  return (
    <>
      <div className="auth-panel-heading">
        <p className="eyebrow">
          {registering ? "Make yourself at home" : "Good to see you again"}
        </p>
        <h1>{registering ? "Join the good side." : "Welcome back."}</h1>
        <p className="muted">
          {registering
            ? "A little more you. A lot more to discover."
            : "Sign in to your UWA account."}
        </p>
      </div>
      <form className="form-grid" onSubmit={submit} aria-busy={busy}>
        {registering && (
          <div className="form-row">
            <div className="field">
              <label htmlFor="firstname">First name</label>
              <input
                id="firstname"
                name="firstname"
                autoComplete="given-name"
                required
                maxLength={60}
                disabled={busy}
              />
            </div>
            <div className="field">
              <label htmlFor="lastname">Last name</label>
              <input
                id="lastname"
                name="lastname"
                autoComplete="family-name"
                required
                maxLength={60}
                disabled={busy}
              />
            </div>
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={254}
            placeholder="you@example.com"
            disabled={busy}
          />
        </div>
        {registering && (
          <div className="field">
            <label htmlFor="mobile">Mobile number</label>
            <input
              id="mobile"
              name="mobile"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              required
              minLength={7}
              maxLength={30}
              aria-describedby="mobile-help"
              disabled={busy}
            />
            <p className="form-help muted" id="mobile-help">
              Include your country code, for example +44.
            </p>
          </div>
        )}
        <div className="field">
          <div className="form-label">
            <label htmlFor="password">Password</label>
            {!registering && (
              <Link className="text-link" href="/forgot">
                Forgot password?
              </Link>
            )}
          </div>
          <div className="password-field">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={registering ? "new-password" : "current-password"}
              required
              minLength={registering ? 8 : undefined}
              maxLength={registering ? 128 : undefined}
              aria-describedby={registering ? "password-help" : undefined}
              disabled={busy}
            />
            <button
              className="password-toggle"
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              disabled={busy}
            >
              {showPassword ? (
                <EyeOff size={19} aria-hidden="true" />
              ) : (
                <Eye size={19} aria-hidden="true" />
              )}
            </button>
          </div>
          {registering && (
            <p className="form-help muted" id="password-help">
              Use at least 8 characters.
            </p>
          )}
        </div>
        {registering && (
          <div className="field">
            <label htmlFor="confirmation">Confirm password</label>
            <input
              id="confirmation"
              name="confirmation"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              disabled={busy}
            />
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button button-dark"
          type="submit"
          disabled={!ready || busy}
        >
          {busy ? (
            <>
              <LoaderCircle size={18} className="spin" aria-hidden="true" />
              {registering ? "Creating your account…" : "Signing you in…"}
            </>
          ) : (
            <>
              {registering ? "Create account" : "Sign in"}
              <ArrowRight size={18} aria-hidden="true" />
            </>
          )}
        </button>
      </form>
      <p className="auth-footnote muted">
        {registering ? "Already part of UWA?" : "New around here?"}{" "}
        <Link className="text-link" href={registering ? "/signin" : "/signup"}>
          {registering ? "Sign in" : "Create an account"}{" "}
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </p>
    </>
  );
}

export function AccountPanel() {
  const { account, ready, signOut } = useStore();
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function leave() {
    if (busy) return;
    setBusy(true);
    await signOut();
    router.replace("/signin");
  }

  if (!ready)
    return (
      <div className="account-panel" role="status">
        <LoaderCircle className="spin" size={24} aria-hidden="true" />
        <p>Loading your account…</p>
      </div>
    );

  if (!account)
    return (
      <div className="account-panel form-success">
        <UserRound size={44} strokeWidth={1.2} aria-hidden="true" />
        <h1>Your space at UWA.</h1>
        <p className="muted">
          Sign in to see your account details, or join us to start exploring.
        </p>
        <div className="account-actions">
          <Link href="/signin" className="button button-dark">
            Sign in <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link href="/signup" className="button button-outline">
            Create an account
          </Link>
        </div>
      </div>
    );

  return (
    <div className="account-grid">
      <div className="account-panel">
        <div className="account-heading">
          <div className="account-avatar" aria-hidden="true">
            {account.firstname.slice(0, 1).toUpperCase() || (
              <UserRound size={24} />
            )}
          </div>
          <div>
            <p className="eyebrow">Your account</p>
            <h1>Hello, {account.firstname}.</h1>
          </div>
        </div>
        <p className="muted">A good place to start your next discovery.</p>
        <dl className="account-details">
          <div className="account-detail">
            <dt>Name</dt>
            <dd>
              {account.firstname} {account.lastname}
            </dd>
          </div>
          <div className="account-detail">
            <dt>Email address</dt>
            <dd>{account.email}</dd>
          </div>
        </dl>
        <button
          className="button button-outline"
          type="button"
          onClick={leave}
          disabled={busy}
        >
          {busy ? (
            <LoaderCircle className="spin" size={17} aria-hidden="true" />
          ) : (
            <LogOut size={17} aria-hidden="true" />
          )}
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>
      <div className="account-panel">
        <p className="eyebrow">Find your next favourite</p>
        <h2>Good things are waiting.</h2>
        <p className="muted">
          Explore the collection and make a little room for something you love.
        </p>
        <Link href="/products" className="button button-yellow">
          Explore the collection <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
