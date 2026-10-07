"use client";

import { useEffect, useId, useRef } from "react";

export function LoginErrorDialog({
  message,
  title,
  closeLabel,
  onClose,
}: {
  message: string | null;
  title: string;
  closeLabel: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    if (message && !dialog.current?.open) dialog.current?.showModal();
    else if (!message && dialog.current?.open) dialog.current.close();
  }, [message]);
  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
      onClose={onClose}
      className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-red-400/50 bg-slate-950 p-6 text-white shadow-2xl backdrop:bg-black/70"
    >
      <h2 id={`${id}-title`} className="text-lg font-semibold">
        {title}
      </h2>
      <p id={`${id}-message`} className="mt-3 text-sm text-red-200">
        {message}
      </p>
      <button
        type="button"
        onClick={() => dialog.current?.close()}
        className="mt-6 w-full rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white hover:bg-blue-400"
      >
        {closeLabel}
      </button>
    </dialog>
  );
}
