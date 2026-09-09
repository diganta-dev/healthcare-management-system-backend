import { z } from "zod";

// A doctor writes this after an appointment is COMPLETED (Project
// Requirements section 9): key findings, plus a list of prescribed medicines.
export const CreatePrescriptionValidationZodSchema = z.object({
    appointmentId: z.string().min(1, "Appointment Id Is Required"),

    findings: z
        .string()
        .trim()
        .min(5, "Findings Must Be At Least 5 Characters Long"),

    medicines: z
        .array(
            z.object({
                name: z.string().trim().min(1, "Medicine Name Is Required"),
                dosage: z.string().trim().min(1, "Dosage Is Required"),
                duration: z.string().trim().min(1, "Duration Is Required"),
                instructions: z.string().trim().optional(),
            }),
        )
        .min(1, "At Least One Medicine Is Required"),
});