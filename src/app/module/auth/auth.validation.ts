import z from "zod";

const PatientRegistrationZodSchema = z.object({
	name: z.string("Name must be a string").min(3).max(20),
	email: z.email("follow the email format"),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.max(20, "Password must be at most 20 characters")
		.regex(/[A-Z]/, "Password must contain at least one uppercase letter")
		.regex(/[0-9]/, "Password must contain at least one number")
		.regex(
			/[^a-zA-Z0-9]/,
			"Password must contain at least one special character",
		),
	patient: z
		.object({
			contactNumber: z.string().optional(),
		})
		.optional(),
});
const LoginZodSchema = z.object({
	email: z.email(),
	password: z
		.string()
		.min(8, "Password Must Minimum 8 Characters Long.")
		.regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter") 
		.regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")

		.regex(/[0-9]/, "Password must contain atleast 1 Number")
		.regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
});

export const UserValidation = {
	PatientRegistrationZodSchema,
	LoginZodSchema,
};
