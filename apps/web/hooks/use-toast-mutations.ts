import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { showSuccess, showError, showLoading, dismissToast } from "@/lib/utils/toast";

interface ToastContext {
  toastId: string | number;
}

type ToastMutationOptions<TData, TError, TVariables> = Omit<
  UseMutationOptions<TData, TError, TVariables, ToastContext>,
  "onMutate" | "onSuccess" | "onError"
> & {
  loadingMessage?: string;
  successMessage?: string | ((data: TData) => string);
  errorMessage?: string | ((error: TError) => string);
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: TError, variables: TVariables) => void;
};

/**
 * Hook React Query avec integration des toasts automatiques.
 *
 * Workflow:
 * 1. onMutate: affiche un toast "loading".
 * 2. onSuccess: remplace par un toast "success".
 * 3. onError: remplace par un toast "error".
 *
 * @template TData - Type de donnees retournees.
 * @template TError - Type d'erreur.
 * @template TVariables - Type des variables mutation.
 */
export function useToastMutation<TData = unknown, TError = Error, TVariables = void>(
  options: ToastMutationOptions<TData, TError, TVariables>
) {
  const {
    loadingMessage = "Chargement...",
    successMessage,
    errorMessage,
    onSuccess,
    onError,
    ...mutationOptions
  } = options;

  return useMutation<TData, TError, TVariables, ToastContext>({
    ...mutationOptions,
    onMutate: async () => {
      const toastId = showLoading(loadingMessage);
      return { toastId };
    },
    onSuccess: (data, variables, context) => {
      if (context?.toastId) {
        dismissToast(context.toastId);
      }

      if (successMessage) {
        const message =
          typeof successMessage === "function" ? successMessage(data) : successMessage;
        showSuccess(message);
      }

      onSuccess?.(data, variables);
    },
    onError: (error, variables, context) => {
      if (context?.toastId) {
        dismissToast(context.toastId);
      }

      const message = errorMessage
        ? typeof errorMessage === "function"
          ? errorMessage(error)
          : errorMessage
        : error instanceof Error
          ? error.message
          : "Une erreur est survenue";

      showError(message);
      onError?.(error, variables);
    },
  });
}
