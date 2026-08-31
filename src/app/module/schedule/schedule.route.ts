import { Router } from "express";
import { ScheduleController } from "./schedule.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";

const router = Router();

router.post(
	"/create-schedule",
	auth(Role.DOCTOR, Role.ADMIN),
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
    auth(Role.DOCTOR, Role.ADMIN ,Role.DOCTOR),
    ScheduleController.getScheduleById,
);

export const ScheduleRoutes = router;
