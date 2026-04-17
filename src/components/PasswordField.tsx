"use client";

import { useId, useState } from "react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
};

export function PasswordField({ label, className, id, ...inputProps }: Props) {
  const [show, setShow] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-xs uppercase tracking-widest text-black/60 mb-1"
      >
        {label}
      </label>
      <div className="relative">
        <input
          {...inputProps}
          id={inputId}
          type={show ? "text" : "password"}
          className={
            "w-full border border-black/20 bg-white pl-3 pr-10 py-2 focus:border-accent focus:outline-none " +
            (className ?? "")
          }
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          tabIndex={-1}
          className="absolute inset-y-0 right-0 px-3 flex items-center text-black/40 hover:text-black/70"
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.5 0-10-7-10-7a18.7 18.7 0 0 1 4.22-5.19" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a18.6 18.6 0 0 1-3.17 4.19" />
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
