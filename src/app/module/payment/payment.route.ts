import { Router } from "express";
import { PaymentController } from "./payment.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";

const router = Router();
router.get(
	"/my-payment/:paymentId",
	auth(Role.PATIENT, Role.ADMIN, Role.SUPER_ADMIN),
	PaymentController.getMypayment,
);
router.get(
	"/",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	PaymentController.getAllPayments,
);
router.get(
	"/:paymentId",
	auth(Role.PATIENT, Role.DOCTOR, Role.ADMIN, Role.SUPER_ADMIN),
	PaymentController.getSinglePayment,
);

export const PaymentRoute = router;
