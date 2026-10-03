import { z } from "zod";

// Mobile ou fixe français, avec ou sans indicatif (+33 / 0033), séparateurs espace, point ou tiret.
const FR_PHONE = /^(?:(?:\+|00)33|0)\s?[1-9](?:[\s.-]?\d{2}){4}$/;

export const phoneSchema = z.string().trim().regex(FR_PHONE, "Numéro de téléphone français invalide.");

export const driverSchema = z.object({
  first_name: z.string().trim().min(1, "Le prénom est obligatoire."),
  last_name: z.string().trim().min(1, "Le nom est obligatoire."),
  phone: phoneSchema,
  license_number: z.string().trim().min(1, "La carte professionnelle est obligatoire."),
});

export type DriverValues = z.infer<typeof driverSchema>;
