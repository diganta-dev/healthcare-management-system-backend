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