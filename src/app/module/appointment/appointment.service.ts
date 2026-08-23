import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";

const bookAppointment = async (payload: IAppointment) => {
	const idToken = await getBkashIdToken();
	if (!idToken) {
		throw new Error("Failed to get bKash id token");
	}
	const createBkashPayment = await fetch(
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
				payerReference: "01723888888", //user phone number or email
				callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
				merchantAssociationInfo: "MI05MID54RF09123456One",
				amount: "12",
				currency: "BDT",
				intent: "sale",
				merchantInvoiceNumber: "Inv0124", //apointment id
			}),
		},
	);

	if (!createBkashPayment.ok) {
		throw new Error("Failed to create bKash payment");
	}

	const bkashCreatePaymentResult = await createBkashPayment.json();

	return bkashCreatePaymentResult;
};

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const bookAppointmentPaymentCallback = async (query: any) => {
	const paymentId = query.paymentID;

	if (!paymentId) {
		throw new Error("Payment Id Missing");
	}

	const status = query.status;

	if (!status) {
		throw new Error("Payment Status is Missing");
	}
	const idToken = await getBkashIdToken();
	if (!idToken) {
		throw new Error("Failed to get bKash id token");
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
		throw new Error("Failed to execute bKash payment");
	}
	const executeBkashPaymentResult = await executeBkashPayment.json();
	if (status === "success") {
		return {
			executeBkashPaymentResult,
			redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=success`,
		};
	}
	if (status === "failure") {
		return {
			executeBkashPaymentResult,
			redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=failue`,
		};
	}
	if (status === "cancel") {
		return {
			executeBkashPaymentResult,
			redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=cancel`,
		};
	}

	return {
		executeBkashPaymentResult,
		redirectUrl: `${config.frontend_url}/dashboard/my-appointments`,
	};
};

export const AppointmentService = {
	bookAppointment,

	bookAppointmentPaymentCallback,
};
