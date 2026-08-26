import { z } from "zod";

export const ApplyDoctorZodSchema = z.object({
	user: z.object({
		name: z
			.string()
			.trim()
			.min(2, "Name must be at least 2 characters")
			.max(100, "Name must not exceed 100 characters"),

		email: z.email("Please provide a valid email address"),
	}),

	doctor: z.object({
		specialization: z
			.string()
			.trim()
			.min(2, "Specialization is required")
			.max(100, "Specialization must not exceed 100 characters"),

		licenseNumber: z
			.string()
			.trim()
			.min(3, "License number is required")
			.max(50, "License number must not exceed 50 characters"),

		qualifications: z
			.string()
			.trim()
			.min(2, "Qualifications are required")
			.max(200, "Qualifications must not exceed 200 characters"),

		experienceYears: z
			.number()
			.int("Experience years must be an integer")
			.min(0, "Experience years cannot be negative")
			.max(70, "Experience years cannot exceed 70"),

		bio: z
			.string()
			.trim()
			.max(1000, "Bio must not exceed 1000 characters")
			.optional(),

		consultationFee: z
			.number()
			.positive("Consultation fee must be greater than 0")
			.multipleOf(0.01, "Consultation fee can have at most 2 decimal places"),
	}),
});

export type IApplyDoctor = z.infer<typeof ApplyDoctorZodSchema>;
