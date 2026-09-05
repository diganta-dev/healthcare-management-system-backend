import { Router } from "express";
import { PaymentController } from "./payment.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";

const router = Router();
router.get("/my-payment/:paymentId", PaymentController.getMypayment);
router.get("/",auth(Role.ADMIN,Role.SUPER_ADMIN), PaymentController.getAllPayments);
router.get("/:paymentId", PaymentController.getSinglePayment);

export const PaymentRoute = router; 