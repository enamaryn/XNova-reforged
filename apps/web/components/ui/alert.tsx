import * as React from "react";
import { cn } from "@/lib/utils";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(
        "rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700",
        className
      )}
      {...props}
    />
  )
);
Alert.displayName = "Alert";

export { Alert };
