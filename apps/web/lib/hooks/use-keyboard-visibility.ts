"use client";

import { useEffect, useRef, useState } from "react";

/** Garde le champ visible seulement lorsque le clavier à l’écran réduit la zone visible. */
export function useKeyboardVisibility(enabled = true) {
  const formRef = useRef<HTMLFormElement>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const viewport = window.visualViewport;
    if (
      !viewport ||
      !(
        navigator.maxTouchPoints > 0 ||
        window.matchMedia("(pointer: coarse)").matches
      )
    )
      return;
    let fullHeight = viewport.height;
    let frame = 0;
    let pending = 0;
    const reveal = () => {
      const input = document.activeElement;
      if (
        !(input instanceof HTMLInputElement) ||
        !formRef.current?.contains(input) ||
        !["text", "email", "password"].includes(input.type)
      )
        return;
      const bounds = input.getBoundingClientRect();
      const top = viewport.offsetTop + 16;
      const bottom = viewport.offsetTop + viewport.height - 24;
      if (bounds.bottom > bottom)
        window.scrollBy({ top: bounds.bottom - bottom, behavior: "smooth" });
      else if (bounds.top < top)
        window.scrollBy({ top: bounds.top - top, behavior: "smooth" });
    };
    const update = () => {
      // Zoom et barres du navigateur ne sont pas une ouverture de clavier.
      if (Math.abs(viewport.scale - 1) > 0.01) return;
      fullHeight = Math.max(fullHeight, viewport.height);
      const difference = fullHeight - viewport.height;
      const inset = difference > 100 ? difference : 0;
      setKeyboardInset(inset);
      if (inset) {
        cancelAnimationFrame(frame);
        cancelAnimationFrame(pending);
        // Attendre l’ajout de l’espace de défilement après le rendu React.
        frame = requestAnimationFrame(() => {
          pending = requestAnimationFrame(reveal);
        });
      }
    };
    const resetOrientation = () => {
      fullHeight = viewport.height;
      setKeyboardInset(0);
    };
    viewport.addEventListener("resize", update);
    formRef.current?.addEventListener("focusin", update);
    window.addEventListener("orientationchange", resetOrientation);
    const form = formRef.current;
    return () => {
      viewport.removeEventListener("resize", update);
      form?.removeEventListener("focusin", update);
      window.removeEventListener("orientationchange", resetOrientation);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(pending);
    };
  }, [enabled]);
  return { formRef, keyboardInset };
}
