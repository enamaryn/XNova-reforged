import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Une erreur est survenue",
  message = "Impossible de charger les donnees. Veuillez reessayer.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 py-12 text-center", className)}>
      <AlertCircle className="h-12 w-12 text-red-500" />
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{message}</p>
      </div>
      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          Reessayer
        </Button>
      )}
    </div>
  );
}
