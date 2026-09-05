import { Router } from "express";
import { DoctorController } from "./doctor.controller";
import { upload } from "../../lib/multer";
import { validateRequest } from "../../middleware/validateRequest";
import { validateQuery } from "../../middleware/validateQuery";
import {
	ApplyDoctorZodSchema,
	GetPublicDoctorListZodSchema,
	UpdateDoctorProfileZodSchema,
} from "./doctor.validation";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/browser";

const router = Router();

// ── Auth-protected routes ───────────────────────────────────────────────────────
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
router.patch(
	"/update-doctor-profile",
	auth(Role.DOCTOR),
	upload.single("profilePicture"),
	validateRequest(UpdateDoctorProfileZodSchema),
	DoctorController.updateDoctorProfile,
);

// ── Public routes (no authentication required) ─────────────────────────────────
router.get(
	"/public/doctors",
	validateQuery(GetPublicDoctorListZodSchema),
	DoctorController.getAllDoctorPublicList,
);

router.get(
	"/public/doctors/available-today",
	validateQuery(GetPublicDoctorListZodSchema),
	DoctorController.getAvailableDoctorToday,
);

router.get(
	"/public/doctors/:doctorId",
	DoctorController.getSinglePublicDoctorProfile,
);

export const DoctorRoute = router;

