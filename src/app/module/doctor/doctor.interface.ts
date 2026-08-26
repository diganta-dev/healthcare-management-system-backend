import { DoctorVerificationStatus } from "../../../generated/prisma/enums";

export interface IDoctorPayload {
	user: {
		name: string;
		email: string;
	};
	doctor: {
		address?: string;
		experienceYears: number;
		licenseNumber: string;
		qualifications: string;
		specialization: string;
		bio?: string;
		consultationFee?: number;
		contactNumber?: string;
	};
}
export interface IVerifyDoctorPayload {
	email: string;
	otp: string;
}

export interface IApproveDoctorPayload {
	doctorId: string;
	verificationStatus: DoctorVerificationStatus;
	rejectionReason: string;
}

export interface IGetAllDoctorsPayload {
	searchTerm?: string;
	specialization?: string;
	address?: string;
	qualifications?: string;
	verificationStatus?: DoctorVerificationStatus;
	experienceYears?: number | string;
	minConsultationFee?: number | string;
	maxConsultationFee?: number | string;
	isDeleted?: boolean | string;
	page?: number | string;
	limit?: number | string;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}

