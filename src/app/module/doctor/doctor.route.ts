import { Router } from "express";
import { DoctorController } from "./doctor.controller";
import { upload } from "../../lib/multer";
import { validateRequest } from "../../middleware/validateRequest";
import { ApplyDoctorZodSchema } from "./doctor.validation";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/browser";

const router = Router();

router.post(
	"/apply-as-doctor",
	upload.fields([
		{ name: "resume", maxCount: 1 },
		{ name: "additionalFiles", maxCount: 5 },
	]),
	validateRequest(ApplyDoctorZodSchema),
	DoctorController.applyDoctor,
);
router.post(
	"/apply-as-doctor/verify-email",
	DoctorController.verifyDoctorEmail,
);
router.post(
	"/approve-doctor",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	DoctorController.aproveDoctorApplication,
);
router.get(
	"/all-doctors",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	DoctorController.getAllDoctors,
);

export const DoctorRoute = router;
