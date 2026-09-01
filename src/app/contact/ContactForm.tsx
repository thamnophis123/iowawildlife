"use client";

import { useState } from "react";

const fieldClassName =
  "mt-1 w-full rounded-lg border border-[#d8e3d4] bg-white px-3 py-2 text-stone-800 outline-none focus:border-[#2d6a4f]";

export default function ContactForm() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  if (sent) {
    return (
      <p className="mt-8 rounded-xl border border-[#d8e3d4] bg-[#fbfaf6] p-4 text-sm text-[#1b4332]">
        Thanks — your message was sent.
      </p>
    );
  }

  return (
    <form
      className="relative mt-8 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        setError(null);
        setPending(true);

        void fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: String(data.get("name") ?? ""),
            email: String(data.get("email") ?? ""),
            message: String(data.get("message") ?? ""),
            company: String(data.get("company") ?? ""),
          }),
        })
          .then(async (response) => {
            const payload = (await response.json()) as { error?: string };
            if (!response.ok) {
              throw new Error(payload.error || "Message could not be sent.");
            }
            setSent(true);
          })
          .catch((cause: unknown) => {
            setError(
              cause instanceof Error
                ? cause.message
                : "Message could not be sent.",
            );
          })
          .finally(() => {
            setPending(false);
          });
      }}
    >
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
        <label>
          Company
          <input
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>
      <label className="block text-sm font-medium text-[#1b4332]">
        Name
        <span className="font-normal text-stone-500"> (optional)</span>
        <input className={fieldClassName} type="text" name="name" maxLength={200} />
      </label>
      <label className="block text-sm font-medium text-[#1b4332]">
        Email
        <span className="font-normal text-stone-500">
          {" "}
          (optional, so we can reply)
        </span>
        <input
          className={fieldClassName}
          type="email"
          name="email"
          maxLength={320}
          autoComplete="email"
        />
      </label>
      <label className="block text-sm font-medium text-[#1b4332]">
        Message
        <textarea
          className={`${fieldClassName} min-h-32`}
          name="message"
          required
          maxLength={5000}
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        className="rounded-lg bg-[#1b4332] px-4 py-2 text-sm font-medium text-white hover:bg-[#2d6a4f] disabled:opacity-60"
        type="submit"
        disabled={pending}
      >
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
