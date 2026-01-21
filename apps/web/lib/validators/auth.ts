import { z } from "zod";

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(3, "L'identifiant doit contenir au moins 3 caracteres"),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caracteres"),
});

export type LoginSchema = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Le nom d'utilisateur doit contenir au moins 3 caracteres")
    .max(20, "Le nom d'utilisateur ne peut pas depasser 20 caracteres")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Le nom d'utilisateur ne peut contenir que des lettres, chiffres, tirets et underscores"
    ),
  email: z.string().email("L'adresse email n'est pas valide"),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caracteres")
    .max(100, "Le mot de passe ne peut pas depasser 100 caracteres")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre"
    ),
});

export type RegisterSchema = z.infer<typeof registerSchema>;
