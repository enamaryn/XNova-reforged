"use client";

// Keep the App Router outlet mounted and visible during navigation. Waiting for
// an exit animation can strand the new route behind an invisible old outlet.
export function PageTransition({ children }: { children: React.ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}
