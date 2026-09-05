import type { UploadApiResponse } from "cloudinary";
import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { cloudinaryConfig } from "../../lib/cloudinary";
import type {
	IApproveDoctorPayload,
	IDoctorPayload,
	IGetAllDoctorsPayload,
	IPublicDoctorListPayload,
	IVerifyDoctorPayload,
} from "./doctor.interface";
import {
	DoctorVerificationStatus,
	Role,
	ScheduleStatus,
	UserStatus,
} from "../../../generated/prisma/enums";
import type { DoctorWhereInput } from "../../../generated/prisma/models";
import config from "../../config";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import redisClient from "../../lib/redis";
import ejs from "ejs";
import path from "path";
import { transporter } from "../../lib/nodemailer";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { addDays, startOfDay } from "date-fns";

const applyDoctor = async (
	payload: IDoctorPayload,
	resume: Express.Multer.File,
	additionalFiles: Express.Multer.File[],
) => {
	const isUserExist = await prisma.user.findUnique({
		where: {
			email: payload.user.email,
		},
	});
	if (isUserExist) {
		throw new AppError(httpStatus.CONFLICT, "User Already Exists");
	}
	// upload resume to cloudinary
	const resumeResult = await new Promise<UploadApiResponse>(
		(resolve, reject) => {
			cloudinaryConfig.uploader
				.upload_stream(
					{
						resource_type: "auto",
					},
					(error, result) => {
						if (error) {
							return reject(error);
						}
						if (!result) {
							return reject(
								new AppError(
									httpStatus.INTERNAL_SERVER_ERROR,
									"Upload failed: no result returned",
								),
							);
						}
						resolve(result);
					},
				)
				.end(resume.buffer);
		},
	);
	// upload additional files to cloudinary
	const additionalFilesResults = await Promise.all(
		additionalFiles.map(
			(file) =>
				new Promise<UploadApiResponse>((resolve, reject) => {
					cloudinaryConfig.uploader
						.upload_stream(
							{
								resource_type: "auto",
							},
							(error, result) => {
								if (error) {
									return reject(error);
								}
								if (!result) {
									return reject(
										new AppError(
											httpStatus.INTERNAL_SERVER_ERROR,
											"Upload failed: no result returned",
										),
									);
								}
								resolve(result);
							},
						)
						.end(file.buffer);
				}),
		),
	);
	const doctorPassowrd = Math.random().toString(36).slice(-8);

	const hashedPassword = await bcrypt.hash(
		doctorPassowrd,
		Number(config.bcrypt_salt_rounds),
	);

	const doctorApplication = await prisma.user.create({
		data: {
			...payload.user,
			role: Role.DOCTOR,
			password: hashedPassword,
			needPasswordChange: true,

			doctors: {
				create: {
					name: payload.user.name,
					email: payload.user.email,
					...payload.doctor,
					resume: resumeResult.secure_url,
					resumePublicId: resumeResult.public_id,
					additionalFiles: additionalFilesResults.map((file) => ({
						url: file.secure_url,
						publicId: file.public_id,
					})),
				},
			},
		},
		include: {
			doctors: true,
		},
	});

	const otp = crypto.randomInt(100000, 999999).toString();
	// Here you can send the OTP to the user's email using your preferred email service
	const expirationSeconds = 5 * 60;
	const key = `doctor-verify-otp:${payload.user.email}`;
	await redisClient.set(key, otp, {
		expiration: {
			type: "EX",
			value: expirationSeconds, // 5 minutes in seconds
		},
	});
	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/user-registration-otp.ejs",
	);
	const templateData = {
		name: payload.user.name,
		otp: otp,
	};
	const html = await ejs.renderFile(templatePath, templateData);
	await transporter.sendMail({
		from: config.SENDER_EMAIL_USER,
		to: payload.user.email,
		subject: "Registration verification",
		html: html,
	});

	return doctorApplication;
};

const verifyDoctorEmail = async (payload: IVerifyDoctorPayload) => {
	const { email, otp } = payload;
	const existingDoctor = await prisma.user.findUnique({
		where: {
			email: email,
			role: Role.DOCTOR,
		},
	});
	if (!existingDoctor) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Doctor Application not found,Please apply Again",
		);
	}
	if (existingDoctor.emailVerified) {
		throw new AppError(httpStatus.BAD_REQUEST, "Doctor Email Already Verified");
	}
	const key = `doctor-verify-otp:${payload.email}`;
	const storedOtp = await redisClient.get(key);

	if (!storedOtp) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"OTP expired ,Your Application window has been closed, Please apply again",
		);
	}

	if (storedOtp !== otp) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid OTP");
	}
	await redisClient.del(key); // Delete the OTP from Redis after successful verification

	// If the OTP is valid, update the doctor's email verification status
	const verifiedDoctorEmail = await prisma.user.update({
		where: {
			id: existingDoctor.id,
		},
		data: {
			emailVerified: true,
		},
		omit: { password: true },
		include: {
			doctors: true,
		},
	});
	return verifiedDoctorEmail;
};

const aproveDoctorApplication = async (
	payload: IApproveDoctorPayload,
	reviewer: RequestUser,
) => {
	const { doctorId, verificationStatus, rejectionReason } = payload;
	const existingDoctor = await prisma.doctor.findUnique({
		where: {
			id: doctorId,
		},
		include: {
			user: true, // Include the related user data
		},
	});
	if (!existingDoctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
	}
	if (existingDoctor.isDeleted) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Doctor Application has been deleted",
		);
	}
	if (existingDoctor.user.emailVerified === false) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Doctor Email is not verified, Please verify the email first",
		);
	}
	if (existingDoctor.verificationStatus !== DoctorVerificationStatus.PENDING) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Doctor Application has already been ${existingDoctor.verificationStatus.toLowerCase()}, cannot approve/reject again`,
		);
	}
	if (
		verificationStatus === DoctorVerificationStatus.REJECTED &&
		!rejectionReason
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Rejection reason is required when rejecting a doctor application",
		);
	}
	// Update the doctor's verification status
	const updatedDoctor = await prisma.doctor.update({
		where: {
			id: doctorId,
		},
		data: {
			verificationStatus,
			rejectionReason:
				verificationStatus === DoctorVerificationStatus.REJECTED
					? rejectionReason
					: null,
			reviewedBy: reviewer.userId,
			reviewedAt: new Date(),
		},
	});
	const isApproved = verificationStatus === DoctorVerificationStatus.APPROVED;
	const templatePath = path.join(
		process.cwd(),
		`src/app/templates/${isApproved ? "doctor-approved.ejs" : "doctor-rejected.ejs"}`,
	);
	const templateData = {
		user: {
			name: existingDoctor.user.name,
		},
		doctor: {
			specialization: existingDoctor.specialization,
			licenseNumber: existingDoctor.licenseNumber,
		},
		reason: rejectionReason || "Required documents could not be verified.",
	};
	const html = await ejs.renderFile(templatePath, templateData);

	await transporter.sendMail({
		from: config.SENDER_EMAIL_USER,
		to: existingDoctor.user.email,
		subject: `Doctor Application ${isApproved ? "Approved" : "Rejected"}`,
		html: html,
	});

	return updatedDoctor;
};

const getAllDoctors = async (query: IGetAllDoctorsPayload) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy || "createdAt";
	const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

	const andConditions: DoctorWhereInput[] = [];

	// 1. Search term filter (searching across name, email, specialization, qualifications, address, contactNumber)
	if (query.searchTerm) {
		andConditions.push({
			OR: [
				{
					name: {
						contains: query.searchTerm,
						mode: "insensitive",
					},
				},
				{
					email: {
						contains: query.searchTerm,
						mode: "insensitive",
					},
				},
				{
					specialization: {
						contains: query.searchTerm,
						mode: "insensitive",
					},
				},
				{
					qualifications: {
						contains: query.searchTerm,
						mode: "insensitive",
					},
				},
				{
					address: {
						contains: query.searchTerm,
						mode: "insensitive",
					},
				},
				{
					contactNumber: {
						contains: query.searchTerm,
						mode: "insensitive",
					},
				},
			],
		});
	}

	// 2. Specific field filters
	if (query.specialization) {
		andConditions.push({
			specialization: {
				contains: query.specialization,
				mode: "insensitive",
			},
		});
	}

	if (query.address) {
		andConditions.push({
			address: {
				contains: query.address,
				mode: "insensitive",
			},
		});
	}

	if (query.qualifications) {
		andConditions.push({
			qualifications: {
				contains: query.qualifications,
				mode: "insensitive",
			},
		});
	}

	if (query.verificationStatus) {
		andConditions.push({
			verificationStatus: query.verificationStatus as DoctorVerificationStatus,
		});
	}

	if (query.experienceYears) {
		andConditions.push({
			experienceYears: {
				gte: Number(query.experienceYears),
			},
		});
	}

	if (query.minConsultationFee || query.maxConsultationFee) {
		const feeCondition: Record<string, number> = {};
		if (query.minConsultationFee) {
			feeCondition.gte = Number(query.minConsultationFee);
		}
		if (query.maxConsultationFee) {
			feeCondition.lte = Number(query.maxConsultationFee);
		}
		andConditions.push({
			consultationFee: feeCondition,
		});
	}

	// 3. Deleted status filter (default: non-deleted)
	if (query.isDeleted !== undefined) {
		andConditions.push({
			isDeleted: query.isDeleted === "true" || query.isDeleted === true,
		});
	} else {
		andConditions.push({
			isDeleted: false,
		});
	}

	const whereCondition: DoctorWhereInput = {
		AND: andConditions,
	};

	const doctors = await prisma.doctor.findMany({
		where: whereCondition,
		take: limit,
		skip: skip,
		orderBy: {
			[sortBy]: sortOrder,
		},
		include: {
			user: {
				select: {
					id: true,
					name: true,
					email: true,
					role: true,
					status: true,
					imageUrl: true,
					emailVerified: true,
				},
			},
		},
	});

	const totalDoctorCount = await prisma.doctor.count({
		where: whereCondition,
	});

	return {
		meta: {
			page,
			limit,
			total: totalDoctorCount,
			totalPages: Math.ceil(totalDoctorCount / limit),
		},
		data: doctors,
	};
};
const updateDoctorProfile = async (
	doctorId: string,
	payload: Partial<IDoctorPayload>,
	profilePicture?: Express.Multer.File,
) => {
	const existingDoctor = await prisma.doctor.findUnique({
		where: {
			userId: doctorId, // doctorId here is actually the User's id from JWT
		},
		include: {
			user: true, // Include the related user data
		},
	});
	if (!existingDoctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
	}
	if (existingDoctor.isDeleted) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Doctor Profile has been deleted",
		);
	}

	// Upload profile picture to Cloudinary if provided
	let imageUrl: string | undefined;
	let imagePublicId: string | undefined;

	if (profilePicture) {
		// Delete old profile picture from Cloudinary if it exists
		const oldPublicId = existingDoctor.user.imagePublicId;
		if (oldPublicId) {
			await cloudinaryConfig.uploader.destroy(oldPublicId);
		}

		// Upload new profile picture
		const uploadResult = await new Promise<UploadApiResponse>(
			(resolve, reject) => {
				cloudinaryConfig.uploader
					.upload_stream(
						{
							resource_type: "image",
							
						},
						(error, result) => {
							if (error) return reject(error);
							if (!result)
								return reject(
									new AppError(
										httpStatus.INTERNAL_SERVER_ERROR,
										"Profile picture upload failed",
									),
								);
							resolve(result);
						},
					)
					.end(profilePicture.buffer);
			},
		);

		imageUrl = uploadResult.secure_url;
		imagePublicId = uploadResult.public_id;
	}

	// Update doctor and user in a transaction
	const updatedDoctor = await prisma.$transaction(async (tx) => {
		// Update User imageUrl & imagePublicId if new profile picture uploaded
		if (imageUrl && imagePublicId) {
			await tx.user.update({
				where: { id: existingDoctor.userId },
				data: {
					imageUrl,
					imagePublicId,
				},
			});
		}

		return tx.doctor.update({
			where: { id: existingDoctor.id },
			data: {
				name: payload.user?.name || existingDoctor.name,
				email: payload.user?.email || existingDoctor.email,
				address: payload.doctor?.address || existingDoctor.address,
				experienceYears:
					payload.doctor?.experienceYears || existingDoctor.experienceYears,
				licenseNumber:
					payload.doctor?.licenseNumber || existingDoctor.licenseNumber,
				qualifications:
					payload.doctor?.qualifications || existingDoctor.qualifications,
				specialization:
					payload.doctor?.specialization || existingDoctor.specialization,
				bio: payload.doctor?.bio || existingDoctor.bio,
				consultationFee:
					payload.doctor?.consultationFee || existingDoctor.consultationFee,
				contactNumber:
					payload.doctor?.contactNumber || existingDoctor.contactNumber,
			},
			include: {
				user: {
					omit: { password: true },
				},
			},
		});
	});

	return updatedDoctor;
}
/**
 * Public listing of approved, active doctors with search, filter and pagination.
 * No authentication required.
 */
const getAllDoctorPublicList = async (query: IPublicDoctorListPayload) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy || "createdAt";
	const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

	const andConditions: DoctorWhereInput[] = [
		// Only show approved doctors to the public
		{ verificationStatus: DoctorVerificationStatus.APPROVED },
		// Only non-deleted doctors
		{ isDeleted: false },
		// Only active user accounts
		{ user: { status: UserStatus.ACTIVE } },
	];

	// Free-text search across key fields
	if (query.searchTerm) {
		andConditions.push({
			OR: [
				{ name: { contains: query.searchTerm, mode: "insensitive" } },
				{ specialization: { contains: query.searchTerm, mode: "insensitive" } },
				{ qualifications: { contains: query.searchTerm, mode: "insensitive" } },
				{ address: { contains: query.searchTerm, mode: "insensitive" } },
			],
		});
	}

	if (query.specialization) {
		andConditions.push({
			specialization: { contains: query.specialization, mode: "insensitive" },
		});
	}

	if (query.address) {
		andConditions.push({
			address: { contains: query.address, mode: "insensitive" },
		});
	}

	if (query.qualifications) {
		andConditions.push({
			qualifications: { contains: query.qualifications, mode: "insensitive" },
		});
	}

	if (query.experienceYears) {
		andConditions.push({
			experienceYears: { gte: Number(query.experienceYears) },
		});
	}

	if (query.minConsultationFee || query.maxConsultationFee) {
		const feeCondition: Record<string, number> = {};
		if (query.minConsultationFee) feeCondition.gte = Number(query.minConsultationFee);
		if (query.maxConsultationFee) feeCondition.lte = Number(query.maxConsultationFee);
		andConditions.push({ consultationFee: feeCondition });
	}

	const whereCondition: DoctorWhereInput = { AND: andConditions };

	const [doctors, total] = await Promise.all([
		prisma.doctor.findMany({
			where: whereCondition,
			take: limit,
			skip,
			orderBy: { [sortBy]: sortOrder },
			select: {
				id: true,
				name: true,
				specialization: true,
				qualifications: true,
				experienceYears: true,
				consultationFee: true,
				address: true,
				bio: true,
				contactNumber: true,
				createdAt: true,
				user: {
					select: {
						imageUrl: true,
					},
				},
			},
		}),
		prisma.doctor.count({ where: whereCondition }),
	]);

	return {
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
		data: doctors,
	};
};

/**
 * Returns approved doctors who have at least one published schedule today
 * with available slots remaining. No authentication required.
 */
const getAvailableDoctorToday = async (query: IPublicDoctorListPayload) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy || "createdAt";
	const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

	const now = new Date();
	const startOfToday = startOfDay(now);
	const startOfTomorrow = addDays(startOfToday, 1);

	const andConditions: DoctorWhereInput[] = [
		{ verificationStatus: DoctorVerificationStatus.APPROVED },
		{ isDeleted: false },
		{ user: { status: UserStatus.ACTIVE } },
		// Must have at least one published, non-deleted schedule today with open slots
		{
			schedules: {
				some: {
					isDeleted: false,
					status: ScheduleStatus.PUBLISHED,
					availableSlots: { gt: 0 },
					startDateTime: {
						gte: startOfToday,
						lt: startOfTomorrow,
						gt: now, // schedule hasn't started yet
					},
				},
			},
		},
	];

	// Optional filters
	if (query.searchTerm) {
		andConditions.push({
			OR: [
				{ name: { contains: query.searchTerm, mode: "insensitive" } },
				{ specialization: { contains: query.searchTerm, mode: "insensitive" } },
				{ qualifications: { contains: query.searchTerm, mode: "insensitive" } },
				{ address: { contains: query.searchTerm, mode: "insensitive" } },
			],
		});
	}

	if (query.specialization) {
		andConditions.push({
			specialization: { contains: query.specialization, mode: "insensitive" },
		});
	}

	if (query.minConsultationFee || query.maxConsultationFee) {
		const feeCondition: Record<string, number> = {};
		if (query.minConsultationFee) feeCondition.gte = Number(query.minConsultationFee);
		if (query.maxConsultationFee) feeCondition.lte = Number(query.maxConsultationFee);
		andConditions.push({ consultationFee: feeCondition });
	}

	const whereCondition: DoctorWhereInput = { AND: andConditions };

	const [doctors, total] = await Promise.all([
		prisma.doctor.findMany({
			where: whereCondition,
			take: limit,
			skip,
			orderBy: { [sortBy]: sortOrder },
			select: {
				id: true,
				name: true,
				specialization: true,
				qualifications: true,
				experienceYears: true,
				consultationFee: true,
				address: true,
				bio: true,
				contactNumber: true,
				createdAt: true,
				user: {
					select: { imageUrl: true },
				},
				// Include today's available schedules so the frontend can show time slots
				schedules: {
					where: {
						isDeleted: false,
						status: ScheduleStatus.PUBLISHED,
						availableSlots: { gt: 0 },
						startDateTime: {
							gte: startOfToday,
							lt: startOfTomorrow,
							gt: now,
						},
					},
					select: {
						id: true,
						startDateTime: true,
						endDateTime: true,
						availableSlots: true,
						totalSlots: true,
					},
				},
			},
		}),
		prisma.doctor.count({ where: whereCondition }),
	]);

	return {
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
		data: doctors,
	};
};

/**
 * Returns a single doctor's full public profile including today's available schedules.
 * No authentication required. Only approved, active, non-deleted doctors are accessible.
 */
const getSinglePublicDoctorProfile = async (doctorId: string) => {
	const now = new Date();
	const startOfToday = startOfDay(now);
	const startOfTomorrow = addDays(startOfToday, 1);

	const doctor = await prisma.doctor.findUnique({
		where: { id: doctorId },
		select: {
			id: true,
			name: true,
			email: true,
			specialization: true,
			qualifications: true,
			experienceYears: true,
			consultationFee: true,
			address: true,
			bio: true,
			contactNumber: true,
			verificationStatus: true,
			isDeleted: true,
			createdAt: true,
			user: {
				select: {
					imageUrl: true,
					status: true,
				},
			},
			// Today's available schedules
			schedules: {
				where: {
					isDeleted: false,
					status: ScheduleStatus.PUBLISHED,
					availableSlots: { gt: 0 },
					startDateTime: {
						gte: startOfToday,
						lt: startOfTomorrow,
						gt: now,
					},
				},
				select: {
					id: true,
					startDateTime: true,
					endDateTime: true,
					availableSlots: true,
					totalSlots: true,
				},
				orderBy: { startDateTime: "asc" },
			},
		},
	});

	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
	}
	if (doctor.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
	}
	if (doctor.verificationStatus !== DoctorVerificationStatus.APPROVED) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Doctor profile is not publicly available",
		);
	}
	if (doctor.user.status !== UserStatus.ACTIVE) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Doctor account is not active",
		);
	}

	return doctor;
};

export const DoctorService = {
	applyDoctor,
	verifyDoctorEmail,
	aproveDoctorApplication,
	getAllDoctors,
	updateDoctorProfile,
	getAllDoctorPublicList,
	getAvailableDoctorToday,
	getSinglePublicDoctorProfile,
};
