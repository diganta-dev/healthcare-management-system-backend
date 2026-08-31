import httpStatus from "http-status";
import {
	AppointmentStatus,
	PaymentStatus,
} from "../../../generated/prisma/browser";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { isAfter, isBefore, isSameDay } from "date-fns";

const bookAppointment = async (payload: IAppointmentPayload, user: RequestUser) => {
	const transactionResult = await prisma.$transaction(async (tx) => {
		const patient = await tx.patient.findUnique({
			where: {
				userId: user.userId,
			},
		});
		if (!patient) {
			throw new AppError(httpStatus.NOT_FOUND, "Patient not found");
		}
		
		const schedule = await tx.schedule.findUnique({
			where: {
				id: payload.scheduleId,
			},
			include: {
				doctor: true,
			},
		});
		if (!schedule || schedule.isDeleted) {
			throw new AppError(httpStatus.NOT_FOUND, "Schedule not found");
		}
		if(schedule.status !== "PUBLISHED") {
			throw new AppError(httpStatus.BAD_REQUEST, "Schedule is not published");
		}
		const now = new Date();
		if(!isSameDay(now,schedule.startDateTime)) {
			throw new AppError(httpStatus.BAD_REQUEST, "This is not Available Schedule for Today");
		}
		if(!isBefore(now,schedule.startDateTime)) {
			throw new AppError(httpStatus.BAD_REQUEST, "This Schedule is Already Started");
		}

		const existingAppointment = await tx.appointment.findFirst({
			where: {
				scheduleId: payload.scheduleId,
				patientId: patient.id,
			}
			
		});
		if (existingAppointment?.status === AppointmentStatus.PENDING ) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"You have already booked an appointment for this schedule and it is pending payment. Please complete the payment to confirm your appointment.",
			);
		}
		if(existingAppointment?.status === AppointmentStatus.ONGOING) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"You have already booked an appointment for this schedule and it is ongoing. Please wait until the appointment is completed.",
			);
		}
		if(existingAppointment?.status === AppointmentStatus.CONFIRMED) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"You have already booked an appointment for this schedule and it is confirmed. Please wait until the appointment is completed.",
			);
		} 
		if(existingAppointment?.status === AppointmentStatus.COMPLETED) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"You have already booked an appointment for this schedule and it is completed. Please wait until the appointment is completed.",
			);
		} 
		if(schedule.availableSlots===0) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"No available slots for this schedule. Please choose another schedule.",
			);
		}
		if(!schedule.doctor.consultationFee) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Consultation fee is not set for this schedule. Please contact the administrator.",
			);
		}


		const amount = schedule.doctor.consultationFee.toString();

		const appointment = await tx.appointment.create({
			data: {
				status: AppointmentStatus.PENDING,
				scheduleId: payload.scheduleId,
				patientId: patient.id,
				doctorId: schedule.doctorId,
				
			},
		});

		const idToken = await getBkashIdToken();
		if (!idToken) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to get bKash id token",
			);
		}
		const createBkashPaymentResponse = await fetch(
			`${config.bkash_base_url}/tokenized/checkout/create`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: idToken,
					"x-app-key": config.bkash_app_key,
				},
				body: JSON.stringify({
					agreementID: "TokenizedMerchant01L3IKB6H1565072174986", //appointment id
					mode: "0011",
					payerReference: user.email, //user phone number or email
					callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
					merchantAssociationInfo: "MI05MID54RF09123456One",
					amount: amount,
					currency: "BDT",
					intent: "sale",
					merchantInvoiceNumber: appointment.id, //appointment id
				}),
			},
		);

		if (!createBkashPaymentResponse.ok) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Failed to create bKash payment",
			);
		}

		const bkashCreatePaymentResult = await createBkashPaymentResponse.json();
		await tx.payment.create({
			data: {
				appointmentId: appointment.id,
				bkashPaymentId: bkashCreatePaymentResult.paymentID,
				merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
				payerReference: user.email,
				amount: bkashCreatePaymentResult.amount,
				gatewayResponse: bkashCreatePaymentResult,
			},
		});

		return {
			paymentURL: bkashCreatePaymentResult.bkashURL,
		};
	});
	return transactionResult;
};

const payAppointment = async (payload: any, user: RequestUser) => {
	const appointmentId = payload.appointmentId;
	const appointment = await prisma.appointment.findUnique({
		where: {
			id: appointmentId,
		},
		include:{
			schedule:{
				include:{
					doctor:true
				}
			},
		}
	});
	if (!appointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment not found");
	}
	if (appointment.status !== AppointmentStatus.PENDING) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Appointment is not in pending status",
		);
	}
	const idToken = await getBkashIdToken();
	if (!idToken) {
		throw new AppError(
			httpStatus.INTERNAL_SERVER_ERROR,
			"Failed to get bKash id token",
		);
	}
	if(!appointment.schedule.doctor.consultationFee) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Consultation fee is not set for this schedule. Please contact the administrator.",
			);
		}
	const amount = appointment.schedule.doctor.consultationFee.toString();
	const createBkashPaymentResponse = await fetch(
		`${config.bkash_base_url}/tokenized/checkout/create`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: idToken,
				"x-app-key": config.bkash_app_key,
			},
			body: JSON.stringify({
				agreementID: "TokenizedMerchant01L3IKB6H1565072174986", //appointment id
				mode: "0011",
				payerReference: user.email, //user phone number or email
				callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
				merchantAssociationInfo: "MI05MID54RF09123456One",
				amount: amount,
				currency: "BDT",
				intent: "sale",
				merchantInvoiceNumber: appointment.id, //appointment id
			}),
		},
	);

	if (!createBkashPaymentResponse.ok) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Failed to create bKash payment",
		);
	}

	const bkashCreatePaymentResult = await createBkashPaymentResponse.json();
	await prisma.payment.update({
		where: {
			appointmentId: appointment.id,
		},
		data: {
			bkashPaymentId: bkashCreatePaymentResult.paymentID,
			merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
			gatewayResponse: bkashCreatePaymentResult,
		},
	});
	return {
		paymentURL: bkashCreatePaymentResult.bkashURL,
	};
};

const cancelAppointment = async (appointmentId: string, user: RequestUser) => {
	const transactionResult = await prisma.$transaction(async (tx) => {
		const appointment = await tx.appointment.findUnique({
			where: {
				id: appointmentId,
			},
			include: {
				payment: true,
			},
		});
		if (!appointment) {
			throw new AppError(httpStatus.NOT_FOUND, "Appointment not found");
		}
		if (
			appointment.status === "ONGOING" ||
			appointment.status === "COMPLETED"
		) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Appointment cannot be cancelled as it is either ongoing or completed",
			);
		}
		if (appointment.status === "CANCELLED") {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Appointment is already cancelled",
			);
		}
		const updatedAppointment = await tx.appointment.update({
			where: {
				id: appointmentId,
			},
			data: {
				status: AppointmentStatus.CANCELLED,
			},
		});

		const idToken = await getBkashIdToken();
		if (!idToken) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to get bKash id token",
			);
		}
		const refundBkashPaymentResponse = await fetch(
			`${config.bkash_base_url}/tokenized/checkout/payment/refund`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: idToken,
					"x-app-key": config.bkash_app_key,
				},
				body: JSON.stringify({
					paymentID: appointment.payment?.bkashPaymentId,
					amount: appointment.payment?.amount.toString(),
					trxID: appointment.payment?.bkashTrxId,
					sku: "Appointment Cancellation",
					reason: "Patient Cancelled The Appointment",
				}),
			},
		);

		if (!refundBkashPaymentResponse.ok) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Failed to refund bKash payment",
			);
		}

		const bkashRefundPaymentResult = await refundBkashPaymentResponse.json();
		const updatedPayment = await tx.payment.update({
			where: {
				appointmentId: appointmentId,
			},
			data: {
				refundTrxId: bkashRefundPaymentResult.refundTrxID,
				refundedAt: bkashRefundPaymentResult.completedTime,
				refundAmount: bkashRefundPaymentResult.amount,
				refundReason: "Patient Cancelled The Appointment",
				status: PaymentStatus.REFUNDED,
				gatewayResponse: bkashRefundPaymentResult,
			},
		});
		return {
			appointment: updatedAppointment,
			payment: updatedPayment,
		};
	});
	return transactionResult;
};

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const bookAppointmentPaymentCallback = async (query: any) => {
	const transactionResult = await prisma.$transaction(async (tx) => {
		const paymentId = query.paymentID;
		const status = query.status;

		if (!paymentId) {
			throw new AppError(httpStatus.BAD_REQUEST, "Payment Id Missing");
		}

		if (!status) {
			throw new AppError(httpStatus.BAD_REQUEST, "Payment Status is Missing");
		}

		if (status === "success") {
			const idToken = await getBkashIdToken();
			if (!idToken) {
				throw new AppError(
					httpStatus.INTERNAL_SERVER_ERROR,
					"Failed to get bKash id token",
				);
			}
			const executeBkashPayment = await fetch(
				`${config.bkash_base_url}/tokenized/checkout/execute`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
						Authorization: idToken,
						"x-app-key": config.bkash_app_key,
					},
					body: JSON.stringify({
						paymentID: paymentId,
					}),
				},
			);
			if (!executeBkashPayment.ok) {
				throw new AppError(
					httpStatus.BAD_REQUEST,
					"Failed to execute bKash payment",
				);
			}
			const executeBkashPaymentResult = await executeBkashPayment.json();

			if (
				executeBkashPaymentResult.statusCode &&
				executeBkashPaymentResult.statusCode !== "0000"
			) {
				await tx.payment.update({
					where: {
						bkashPaymentId: paymentId,
					},
					data: {
						status: PaymentStatus.FAILED,
						gatewayResponse: executeBkashPaymentResult,
					},
				});
				return {
					redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=failure&message=${executeBkashPaymentResult.statusMessage}`,
				};
			}

			await tx.appointment.update({
				where: {
					id: executeBkashPaymentResult.merchantInvoiceNumber,
				},
				data: {
					status: AppointmentStatus.CONFIRMED,
				},
			});
			await tx.payment.update({
				where: {
					appointmentId: executeBkashPaymentResult.merchantInvoiceNumber,
					bkashPaymentId: paymentId,
				},
				data: {
					status: PaymentStatus.PAID,
					bkashTrxId: executeBkashPaymentResult.trxID,
					paidAt: executeBkashPaymentResult.paymentExecuteTime,
					gatewayResponse: executeBkashPaymentResult,
				},
			});
			return {
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=success`,
			};
		} else if (status === "failure") {
			await tx.payment.update({
				where: {
					bkashPaymentId: paymentId,
				},
				data: {
					status: PaymentStatus.FAILED,
				},
			});
			return {
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=failure`,
			};
		} else if (status === "cancel") {
			await tx.payment.update({
				where: {
					bkashPaymentId: paymentId,
				},
				data: {
					status: PaymentStatus.CANCELLED,
				},
			});
			return {
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=cancel`,
			};
		} else {
			return {
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?error=payment_failed`,
			};
		}
	});
	return transactionResult;
};

export const AppointmentService = {
	bookAppointment,
	payAppointment,
	bookAppointmentPaymentCallback,
	cancelAppointment,
};
