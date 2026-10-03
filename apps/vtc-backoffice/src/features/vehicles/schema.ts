import { z } from "zod";

export const CATEGORIES = ["berline", "van", "suv", "minibus", "luxury"] as const;
export const CATEGORY_LABELS: Record<(typeof CATEGORIES)[number], string> = {
  berline: "Berline",
  van: "Van",
  suv: "SUV",
  minibus: "Minibus",
  luxury: "Luxe",
};
export const STATUSES = ["active", "inactive", "maintenance"] as const;
export const STATUS_LABELS: Record<(typeof STATUSES)[number], string> = {
  active: "Opérationnel",
  inactive: "Hors service",
  maintenance: "Maintenance",
};

export const vehicleSchema = z.object({
  brand: z.string().trim().min(1, "La marque est obligatoire."),
  model: z.string().trim().min(1, "Le modèle est obligatoire."),
  plate_number: z.string().trim().min(1, "La plaque est obligatoire."),
  category: z.enum(CATEGORIES, { message: "Catégorie invalide." }),
  capacity: z.number({ message: "Nombre de passagers requis." }).int("Nombre entier requis.").min(1, "Au moins 1 passager.").max(8, "8 passagers au maximum."),
  luggage_capacity: z.number({ message: "Nombre de bagages requis." }).int("Nombre entier requis.").min(0, "Valeur négative impossible.").max(20, "20 bagages au maximum."),
  status: z.enum(STATUSES, { message: "Statut invalide." }),
});

export type VehicleValues = z.infer<typeof vehicleSchema>;
