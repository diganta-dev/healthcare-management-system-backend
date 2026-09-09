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



export const UpdateDoctorProfileZodSchema = z.object({
    user: z
        .object({
            name: z
                .string()
                .min(2, "Name must be at least 2 characters")
                .max(100, "Name must not exceed 100 characters")
                .optional(),

            email: z
                .string()
                .email("Invalid email address")
                .optional(),
        })
        .optional(),

    doctor: z
        .object({
            address: z
                .string()
                .min(3, "Address must be at least 3 characters")
                .max(255, "Address must not exceed 255 characters")
                .optional(),

            experienceYears: z
                .number()
                .int("Experience years must be an integer")
                .min(0, "Experience years cannot be negative")
                .optional(),

            licenseNumber: z
                .string()
                .min(3, "License number must be at least 3 characters")
                .max(100, "License number must not exceed 100 characters")
                .optional(),

            qualifications: z
                .string()
                .min(2, "Qualifications must be at least 2 characters")
                .max(500, "Qualifications must not exceed 500 characters")
                .optional(),

            specialization: z
                .string()
                .min(2, "Specialization must be at least 2 characters")
                .max(100, "Specialization must not exceed 100 characters")
                .optional(),

            bio: z
                .string()
                .max(1000, "Bio must not exceed 1000 characters")
                .optional(),

            consultationFee: z
                .number()
                .min(0, "Consultation fee cannot be negative")
                .optional(),

            contactNumber: z
                .string()
                .min(10, "Contact number must be at least 10 characters")
                .max(20, "Contact number must not exceed 20 characters")
                .optional(),
        })
        .optional(),
});

// ── Public doctor list query schema ────────────────────────────────────────────
export const GetPublicDoctorListZodSchema = z.object({
    searchTerm: z.string().trim().max(100).optional(),
    specialization: z.string().trim().max(100).optional(),
    address: z.string().trim().max(255).optional(),
    qualifications: z.string().trim().max(200).optional(),
    experienceYears: z
        .string()
        .regex(/^\d+$/, "experienceYears must be a positive integer")
        .optional(),
    minConsultationFee: z
        .string()
        .regex(/^\d+(\.\d{1,2})?$/, "minConsultationFee must be a valid number")
        .optional(),
    maxConsultationFee: z
        .string()
        .regex(/^\d+(\.\d{1,2})?$/, "maxConsultationFee must be a valid number")
        .optional(),
    page: z
        .string()
        .regex(/^\d+$/, "page must be a positive integer")
        .optional(),
    limit: z
        .string()
        .regex(/^\d+$/, "limit must be a positive integer")
        .optional(),
    sortBy: z
        .enum(["createdAt", "experienceYears", "consultationFee", "name"])
        .optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
});

export type IGetPublicDoctorList = z.infer<typeof GetPublicDoctorListZodSchema>;

// ── Single public doctor profile param schema ───────────────────────────────────
export const GetSinglePublicDoctorProfileZodSchema = z.object({
    doctorId: z
        .string()
        .uuid("doctorId must be a valid UUID"),
});

export type IGetSinglePublicDoctorProfile = z.infer<
    typeof GetSinglePublicDoctorProfileZodSchema
>;
