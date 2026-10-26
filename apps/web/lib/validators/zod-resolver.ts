import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { ZodType } from "zod";

/**
 * Résolveur react-hook-form pour un schéma zod (formulaires à champs plats : connexion, inscription).
 * Remplace `@hookform/resolvers`, dont la dépendance optionnelle `ajv ^8` est signalée invalide par `npm ls`
 * (le contrôle d'installation du serveur exige un arbre sans erreur) ; un seul message par champ est conservé.
 */
export function zodResolver<Values extends FieldValues>(schema: ZodType<Values>): Resolver<Values> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) return { values: result.data, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.join(".");
      if (field && !errors[field]) errors[field] = { type: issue.code, message: issue.message };
    }
    return { values: {}, errors: errors as FieldErrors<Values> };
  };
}
