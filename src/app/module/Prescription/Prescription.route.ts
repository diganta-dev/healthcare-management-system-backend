import { Router } from "express";
import { PrescriptionController } from "./prescription.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { CreatePrescriptionValidationZodSchema } from "./prescription.validation";
import { validateRequest } from "../../middleware/validateRequest";

const router = Router()

router.post("/",auth(Role.DOCTOR),validateRequest(CreatePrescriptionValidationZodSchema) ,PrescriptionController.createPrescription);
router.get("/:appointmentId",auth(Role.PATIENT,Role.DOCTOR,Role.ADMIN,Role.SUPER_ADMIN) ,PrescriptionController.getSinglePrescription);

 export const PrescriptionRoute = router;