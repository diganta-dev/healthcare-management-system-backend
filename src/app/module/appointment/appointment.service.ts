import httpStatus from "http-status";
import {
	AppointmentStatus,
	PaymentStatus,
	Role,
} from "../../../generated/prisma/browser";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { addMinutes, isBefore, isSameDay, subHours } from "date-fns";
import { transporter } from "../../lib/nodemailer";
import path from "path";
import ejs from "ejs";
import PDFDocument from "pdfkit";
import type { IAppointmentPayload, IPaymentAppointmentPayload, IUpdateAppointmentPayload } from "./appointment.interface";
import { IQuery } from "../../interfaces/global.interface";
import { AppointmentWhereInput } from "../../../generated/prisma/models";

const bookAppointment = async (
	payload: IAppointmentPayload,
	user: RequestUser,
) => {
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
		if (schedule.status !== "PUBLISHED") {
			throw new AppError(httpStatus.BAD_REQUEST, "Schedule is not published");
		}
		const now = new Date();
		if (!isSameDay(now, schedule.startDateTime)) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"This is not Available Schedule for Today",
			);
		}
		if (!isBefore(now, schedule.startDateTime)) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"This Schedule is Already Started",
			);
		}

		const existingAppointment = await tx.appointment.findFirst({
			where: {
				scheduleId: payload.scheduleId,
				patientId: patient.id,
			},
		});
		if (existingAppointment?.status === AppointmentStatus.PENDING) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"You have already booked an appointment for this schedule and it is pending payment. Please complete the payment to confirm your appointment.",
			);
		}
		if (existingAppointment?.status === AppointmentStatus.ONGOING) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"You have already booked an appointment for this schedule and it is ongoing. Please wait until the appointment is completed.",
			);
		}
		if (existingAppointment?.status === AppointmentStatus.CONFIRMED) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"You have already booked an appointment for this schedule and it is confirmed. Please wait until the appointment is completed.",
			);
		}
		if (existingAppointment?.status === AppointmentStatus.COMPLETED) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"You have already booked an appointment for this schedule and it is completed. Please wait until the appointment is completed.",
			);
		}
		if (schedule.availableSlots === 0) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"No available slots for this schedule. Please choose another schedule.",
			);
		}
		if (!schedule.doctor.consultationFee) {
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

const payAppointment = async (payload: IPaymentAppointmentPayload, user: RequestUser) => {
	const appointmentId = payload.appointmentId;
	const appointment = await prisma.appointment.findUnique({
		where: {
			id: appointmentId,
		},
		include: {
			schedule: {
				include: {
					doctor: true,
				},
			},
		},
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
	if (!appointment.schedule.doctor.consultationFee) {
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
				patient: {
					email: user.email,
				},
			},
			include: {
				payment: true,
				schedule: true,
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
		await tx.schedule.update({
			where: {
				id: appointment.schedule.id,
			},
			data: {
				availableSlots: {
					increment: 1,
				},
			},
		});
		// refund processing
		const now = new Date();
		const startDateTime = appointment.schedule.startDateTime;
		const cutOffTime = subHours(startDateTime, 1);
		const isEligibleForRefund = isBefore(now, cutOffTime);
		if (isEligibleForRefund) {
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
			await tx.payment.update({
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
		}

		const newPayment = await prisma.payment.findUnique({
			where: {
				appointmentId: appointmentId,
			},
		});

		return {
			appointment: updatedAppointment,
			payment: newPayment,
		};
	});
	return transactionResult;
};


// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const bookAppointmentPaymentCallback = async (query: Record<string, any>) => {
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
			const appointment = await tx.appointment.findUnique({
				where: {
					id: executeBkashPaymentResult.merchantInvoiceNumber,
				},
				include: {
					schedule: true,
					patient: true,
					doctor: true,
				},
			});

			if (!appointment) {
				throw new AppError(httpStatus.NOT_FOUND, "Appointment not found");
			}
			const newAvailableSlots = appointment.schedule.availableSlots - 1;

			const allreadyBookedSlots =
				appointment.schedule.totalSlots - appointment.schedule.availableSlots;
			const serailNumber = allreadyBookedSlots + 1;
			const joiningTime = addMinutes(
				appointment.schedule.startDateTime,
				(serailNumber - 1) * 20,
			);

			await tx.appointment.update({
				where: {
					id: executeBkashPaymentResult.merchantInvoiceNumber,
				},
				data: {
					status: AppointmentStatus.CONFIRMED,
					joiningTime: joiningTime,
					serialNumber: serailNumber,
				},
			});
			await tx.schedule.update({
				where: {
					id: appointment.schedule.id,
				},
				data: {
					availableSlots: newAvailableSlots,
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

			// Generate PDF confirmation

			const pdfDocument = new PDFDocument({ margin: 50 });
			const pdfChunks: Buffer[] = [];
			pdfDocument.on("data", (chunk) => {
				pdfChunks.push(chunk);
			});
			const pdfReadyPromise = new Promise<Buffer>((resolve) => {
				pdfDocument.on("end", () => {
					resolve(Buffer.concat(pdfChunks));
				});
			});

			pdfDocument
				.fontSize(22)
				.font("Helvetica-Bold")
				.text("APPOINTMENT CONFIRMATION", {
					align: "center",
				});

			pdfDocument.moveDown(2);

			pdfDocument
				.fontSize(12)
				.font("Helvetica")
				.text(`Patient Name: ${appointment.patient.name}`)
				.moveDown(0.5)
				.text(`Doctor Name: ${appointment.doctor.name}`)
				.moveDown(0.5)
				.text(`Serial Number: ${serailNumber}`)
				.moveDown(0.5)
				.text(`Appointment Time: ${joiningTime.toLocaleString()}`)
				.moveDown(0.5)
				.text(`Meeting Link: ${appointment.schedule.meetingLink}`);

			pdfDocument.moveDown(2);

			pdfDocument.text(`Amount Paid: ${executeBkashPaymentResult.amount} BDT`, {
				align: "left",
			});
			pdfDocument.text(`Payment Method: bKash`, {
				align: "left",
			});
			pdfDocument.text(`Transaction ID: ${executeBkashPaymentResult.trxID}`, {
				align: "left",
			});
			pdfDocument.text(
				`Payment Date: ${new Date(executeBkashPaymentResult.paymentExecuteTime).toLocaleString()}`,
				{
					align: "left",
				},
			);
			pdfDocument.moveDown(2);

			pdfDocument
				.fontSize(11)
				.text("Your appointment has been successfully confirmed.", {
					align: "center",
				});

			pdfDocument.moveDown(3);

			pdfDocument
				.fontSize(10)
				.text("Thank you for using our healthcare service.", {
					align: "center",
				});

			// PDF complete
			pdfDocument.end();
			const pdfBuffer = (await pdfReadyPromise) as Buffer;

			const templatePath = path.join(
				process.cwd(),
				"src/app/templates/appointment-confirmation.ejs",
			);
			const html = await ejs.renderFile(templatePath, {
				patientName: appointment.patient.name,
				doctorName: appointment.doctor.name,
				serialNumber: appointment.serialNumber,
				appointmentTime: appointment.joiningTime,
			});
			await transporter.sendMail({
				from: config.SENDER_EMAIL_USER,
				to: appointment.patient.email,
				subject: "Appointment Confirmation",
				html: html,
				attachments: [
					{
						filename: "invoice.pdf",
						content: pdfBuffer,
						contentType: "application/pdf",
					},
				],
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

const updateAppointmentStatus = async (user:RequestUser, payload: IUpdateAppointmentPayload,appointmentId: string) => {
    const doctor = await prisma.doctor.findUnique({
		where: {
			userId: user.userId,	
			
		}
	});
	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
	}
	
	const appointment = await prisma.appointment.findUnique({
		where: {
			id: appointmentId,
			doctorId: doctor.id,
		},
	}); 
	if(!appointment){
		throw new AppError(httpStatus.NOT_FOUND, "Appointment not found");
	}
	if(appointment.status === AppointmentStatus.COMPLETED){
		throw new AppError(httpStatus.BAD_REQUEST, "Appointment is already completed");
	}
	if(appointment.status === AppointmentStatus.CANCELLED){
		throw new AppError(httpStatus.BAD_REQUEST, "Appointment is cancelled, you cannot update it");
	}
	if(appointment.status=== AppointmentStatus.PENDING){
		
			throw new AppError(httpStatus.BAD_REQUEST, "Appointment is pending, you can only update it to confirmed");
		
	}
	if(appointment.status === AppointmentStatus.CONFIRMED){
		if(payload.status !== AppointmentStatus.ONGOING){
              throw new AppError(httpStatus.BAD_REQUEST, "Appointment is confirmed, you can only update it to ongoing before the appointment is completed");
		}
	}
	await prisma.appointment.update({
		where: {
			id: appointmentId,
		},
		data: {
			status: AppointmentStatus.ONGOING,
		},
	});

	if(appointment.status ===AppointmentStatus.ONGOING){
		if(payload.status !== AppointmentStatus.COMPLETED){
			throw new AppError(httpStatus.BAD_REQUEST, "Appointment is ongoing, you can only update it to completed");
		}
		await prisma.appointment.update({
			where: {
				id: appointmentId,
			},
			data: {
				status: AppointmentStatus.COMPLETED,
			},
		});
	}
	const updatedAppointment = await prisma.appointment.findUnique({
		where: {
			id: appointmentId,
		},
	});
	return updatedAppointment;
	
	
	
}
// patient my appointments
const getMyAppointments = async (user: RequestUser,query:IQuery) => {
    const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	
	const patient = await prisma.patient.findUnique({
		where: {
			userId: user.userId,
		},
	});
	if (!patient) {
		throw new AppError(httpStatus.NOT_FOUND, "Patient not found");
	}
	const andConditions: AppointmentWhereInput[] = [
		{
			patientId: patient.id,
		}
	];
	if(query.status){
		andConditions.push({
			status: query.status as AppointmentStatus,
		});
	} 
	const appointments = await prisma.appointment.findMany({
		where: {
			AND: andConditions,
		},
		take: limit,
		skip: skip,
		orderBy: {
			createdAt: "desc",
		},
		include: {
			schedule: true,
			doctor: {
				select: {
					name: true,
					email: true,
					consultationFee: true,
					specialization: true,
				},
			},
			
			payment: true,
		},
	});
	const totalAppointments = await prisma.appointment.count({
		where: {
			AND: andConditions,
		},
	});
	const totalPages = Math.ceil(totalAppointments / limit);
	return {
		appointments,
		totalAppointments,
		totalPages,
		currentPage: page,
	};	

}
// doctor appointments
const getDoctorAppointments = async (user: RequestUser, query: IQuery) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const doctor = await prisma.doctor.findUnique({
		where: {
			userId: user.userId,
		},
	});
	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
	}
	const andConditions: AppointmentWhereInput[] = [
		{
			doctorId: doctor.id,
		}
	];
	if(query.status){
		andConditions.push({
			status: query.status as AppointmentStatus,
		});
	} 
	const appointments = await prisma.appointment.findMany({
		where: {
			AND: andConditions,
		},
		take: limit,
		skip: skip,
		orderBy: {
			createdAt: "desc",
		},
		include: {
			schedule: true,
			patient: {
				select: {
					name: true,
					email: true,
					id: true,
					contactNumber: true,
				},
			},
			payment: true,
			
		},
		
	});
	const totalAppointments = await prisma.appointment.count({
		where: {
			AND: andConditions,
		},
	});
	const totalPages = Math.ceil(totalAppointments / limit);
	return {
		appointments,
		totalAppointments,
		totalPages,
		currentPage: page,
	};
}
// admin all appointments
const getAllAppointments = async (query: IQuery) => {
      const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const andConditions: AppointmentWhereInput[] = [];
	if(query.status){
		andConditions.push({
			status: query.status as AppointmentStatus,
		});
	}
	if(query.doctorId){
		andConditions.push({
			doctorId: query.doctorId,
		});
	}
	if(query.patientId){
		andConditions.push({
			patientId: query.patientId,
		});
	}
	if(query.doctorEmail){
		andConditions.push({
			doctor: {
				email: query.doctorEmail,
			},
		});
	}
	if(query.patientEmail){
		andConditions.push({
			patient: {
				email: query.patientEmail,
			},
		});
	}
	const appointments = await prisma.appointment.findMany({
		where: {
			AND: andConditions,
		},
		take: limit,
		skip: skip,
		orderBy: {
			createdAt: "desc",
		},
		include: {
			schedule: true,
			doctor: {
				select: {
					name: true,
					email: true,
					id: true,
					specialization: true,
				},
			},
			patient: {
				select: {
					name: true,
					email: true,
					id: true,
					contactNumber: true,
				},
			},
			payment: true,
			
		},
		
	});
	const totalAppointments = await prisma.appointment.count({
		where: {
			AND: andConditions,
		},
	});
	const totalPages = Math.ceil(totalAppointments / limit);
	return {
		appointments,
		totalAppointments,
		totalPages,
		currentPage: page,
	};	

}
// get single appointment
const getSingleAppointment = async (user: RequestUser, appointmentId: string) => {
	const appointment = await prisma.appointment.findUnique({
		where: {
			id: appointmentId,
		},
		include: {
			schedule: true,
			doctor: {
				select: {
					name: true,
					email: true,
				    userId: true,
					specialization: true,
				},
			},
			patient: {
				select: {
					name: true,
					email: true,
					userId: true,
					contactNumber: true,
				},
			},
			payment: true,
			
		},
		
	});
	if (!appointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment not found");
	}
	if(user.role === Role.PATIENT){

		if(appointment.patient.userId !==user.userId ){
		throw new AppError(httpStatus.FORBIDDEN, "You are not the owner of this appointment");
	}
	}
	if(user.role === Role.DOCTOR){
		if(appointment.doctor.userId !==user.userId ){
		throw new AppError(httpStatus.FORBIDDEN, "You are not the owner of this appointment");
	}
	}

 return appointment;
}



export const AppointmentService = {
	bookAppointment,
	payAppointment,
	bookAppointmentPaymentCallback,
	cancelAppointment,
	updateAppointmentStatus,
	getMyAppointments,
	getDoctorAppointments,
	getAllAppointments,
	getSingleAppointment
};
