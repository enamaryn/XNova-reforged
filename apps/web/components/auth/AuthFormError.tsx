import { Alert } from "@/components/ui/alert";

interface AuthFormErrorProps {
  message?: string | null;
}

export function AuthFormError({ message }: AuthFormErrorProps) {
  if (!message) return null;
  return <Alert>{message}</Alert>;
}
