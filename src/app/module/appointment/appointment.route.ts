import { Router } from "express";
import { AppointmentController } from "./appointment.controller";

const router = Router();
router.post("/book-appointment", AppointmentController.bookAppointment);
router.get("/book-appointment/payment/callback",AppointmentController.bookAppointmentPaymentCallback); 

export const AppointMentRoute = router;
