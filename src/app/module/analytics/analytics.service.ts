import httpStatus from "http-status"
import { prisma } from "../../lib/prisma";
import { AppointmentStatus, DoctorVerificationStatus, PaymentStatus, ScheduleStatus } from "../../../generated/prisma/enums";
import { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";


const getAdminAnalytics = async () => {

    //total doctors

    const totalDoctors = await prisma.doctor.count({
        where : {
            isDeleted : false,
        }
    })

    const totalPendingDoctorApplications = await prisma.doctor.count({
        where: {
            isDeleted: false,
            verificationStatus : DoctorVerificationStatus.PENDING
        }
    })

    const totalApprovedDoctors = await prisma.doctor.count({
        where: {
            isDeleted: false,
            verificationStatus: DoctorVerificationStatus.APPROVED,
        },
    });
    const totalRejectedDoctors = await prisma.doctor.count({
        where: {
            isDeleted: false,
            verificationStatus: DoctorVerificationStatus.REJECTED,
        },
    });


    const totalPatients = await prisma.patient.count({
        where: { isDeleted: false },
    });

    const totalAppointments = await prisma.appointment.count();

    const totalCompletedAppointments = await prisma.appointment.count({
        where: { status: AppointmentStatus.COMPLETED },
    });

    const totalCancelledAppointments = await prisma.appointment.count({
        where: { status: AppointmentStatus.CANCELLED },
    });

    const totalRefundResult = await prisma.payment.aggregate({
        where: {
            status: PaymentStatus.PAID
        },
        _sum: {
            amount: true
        }
    })

    const totalRefunded = totalRefundResult._sum.amount?.toNumber() || 0

    const totalRevenueResult = await prisma.payment.aggregate({
        where : {
            status : PaymentStatus.PAID
        },
        _sum : {
            amount : true
        }
    })

    const totalRevenue = (totalRevenueResult._sum.amount?.toNumber() || 0) - totalRefunded 

    

    return {
        totalDoctors,
        totalPendingDoctorApplications,
        totalApprovedDoctors,
        totalRejectedDoctors,
        totalPatients,
        totalAppointments,
        totalCompletedAppointments,
        totalCancelledAppointments,
        totalRevenue,
        totalRefunded
    }


}
const getPatientAnalytics = async (user : RequestUser) => {

    const patient = await prisma.patient.findUnique({
        where: { userId: user.userId },
    });

    if (!patient) {
        throw new AppError(httpStatus.NOT_FOUND, "Patient Profile Not Found");
    }

    const totalAppointments = await prisma.appointment.count({
        where: { patientId: patient.id },
    });

    const upcomingAppointments = await prisma.appointment.count({
        where: { patientId: patient.id, status: AppointmentStatus.CONFIRMED },
    });

    const completedAppointments = await prisma.appointment.count({
        where: { patientId: patient.id, status: AppointmentStatus.COMPLETED },
    });

    const cancelledAppointments = await prisma.appointment.count({
        where: { patientId: patient.id, status: AppointmentStatus.CANCELLED },
    });

    const totalAmountSpentResult = await prisma.payment.aggregate({
        where: {
            appointment: {
                patientId: patient.id,
            },
            status: PaymentStatus.PAID,
        },
        _sum: {
            amount: true,
        },
    });

    const totalAmountSpent = totalAmountSpentResult._sum.amount?.toNumber() || 0;

    const totalRefundedResult = await prisma.payment.aggregate({
        where: {
            appointment: {
                patientId: patient.id,
            },
            status: PaymentStatus.REFUNDED,
        },
        _sum: {
            amount: true,
        },
    });

    const totalRefunded = totalRefundedResult._sum.amount?.toNumber() || 0;

    return {
        totalAppointments,
        upcomingAppointments,
        completedAppointments,
        cancelledAppointments,
        totalAmountSpent,
        totalRefunded
    }


}
const getDoctorAnalytics = async (user : RequestUser) => {
    const doctor = await prisma.doctor.findUnique({
        where: { userId: user.userId },
    });

    if (!doctor) {
        throw new AppError(httpStatus.NOT_FOUND, "Doctor Profile Not Found");
    }

    const totalSchedules = await prisma.schedule.count({
        where: { doctorId: doctor.id, isDeleted: false },
    });

    const publishedSchedules = await prisma.schedule.count({
        where: {
            doctorId: doctor.id,
            isDeleted: false,
            status: ScheduleStatus.PUBLISHED,
        },
    });

    const totalAppointments = await prisma.appointment.count({
        where: { doctorId: doctor.id },
    });

    const upcomingAppointments = await prisma.appointment.count({
        where: { doctorId: doctor.id, status: AppointmentStatus.CONFIRMED },
    });

    const ongoingAppointments = await prisma.appointment.count({
        where: { doctorId: doctor.id, status: AppointmentStatus.ONGOING },
    });

    const completedAppointments = await prisma.appointment.count({
        where: { doctorId: doctor.id, status: AppointmentStatus.COMPLETED },
    });

    const cancelledAppointments = await prisma.appointment.count({
        where: { doctorId: doctor.id, status: AppointmentStatus.CANCELLED },
    });

    const totalDoctorRefundedResult = await prisma.payment.aggregate({
        where: {
            appointment: {
                doctorId: doctor.id,
            },
            status: PaymentStatus.REFUNDED,
        },
        _sum: {
            amount: true,
        },
    });

    const totalDoctorRefunded = totalDoctorRefundedResult._sum.amount?.toNumber() || 0;

    const totalDoctorEarningsResult = await prisma.payment.aggregate({
        where: {
            appointment: {
                doctorId: doctor.id,
            },
            status: PaymentStatus.PAID,
        },
        _sum: {
            amount: true,
        },
    });

    const totalDoctorEarnings = (totalDoctorEarningsResult._sum.amount?.toNumber() || 0) - totalDoctorRefunded;

    

    return {
        totalSchedules,
        publishedSchedules,
        totalAppointments,
        upcomingAppointments,
        ongoingAppointments,
        completedAppointments,
        cancelledAppointments,
        totalDoctorEarnings,
        totalDoctorRefunded
    }

}

export const AnalyticsServices = {
    getAdminAnalytics,
    getPatientAnalytics,
    getDoctorAnalytics
}