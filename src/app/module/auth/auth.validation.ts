import z from "zod";

const PatientRegistrationZodSchema = z.object({
    name: z.string("Name must be a string").min(3).max(20),
    email:z.email("follow the email format"),
    password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(20, "Password must be at most 20 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character"),
    patient: z.object({
        contactNumber: z.string().optional() 
    }).optional()
})

export const PatientValidationSchema = {
    PatientRegistrationZodSchema
}