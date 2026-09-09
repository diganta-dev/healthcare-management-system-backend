import { Router } from "express";
import { ScheduleController } from "./schedule.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { validateRequest } from "../../middleware/validateRequest";
import {
	CreateScheduleValidationZodSchema,
	UpdateScheduleValidationZodSchema,
} from "./schedule.validation";

const router = Router();

router.post(
	"/create-schedule",
	auth(Role.DOCTOR, Role.ADMIN),
	validateRequest(CreateScheduleValidationZodSchema),
	ScheduleController.createSchedule,
);
router.get(
	"/get-schedule",
	auth(Role.DOCTOR, Role.ADMIN),
	ScheduleController.getMySchedule,
);
router.get(
	"/get-all-schedules",
	auth(Role.ADMIN),
	ScheduleController.getAllSchedules,
);
router.get(
	"/get-schedule/:id",
	auth(Role.DOCTOR, Role.ADMIN, Role.DOCTOR),
	ScheduleController.getScheduleById,
);
router.patch(
	"/update-schedule/:id",
	auth(Role.DOCTOR, Role.ADMIN),
	validateRequest(UpdateScheduleValidationZodSchema),
	ScheduleController.updateSchedule,
);
router.delete(
	"/delete-schedule/:id",
	auth(Role.DOCTOR, Role.ADMIN),
	ScheduleController.deleteSchedule,
);
router.patch(
	"/publish-schedule/:id",
	auth(Role.DOCTOR, Role.ADMIN),
	ScheduleController.publishSchedule,
);

export const ScheduleRoutes = router;
