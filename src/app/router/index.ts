import { Router } from "express";
import { AuthRoutes } from "../module/auth/auth.route";
import { UserRoute } from "../module/user/user.route";
import { AppointMentRoute } from "../module/appointment/appointment.route";
import { DoctorRoute } from "../module/doctor/doctor.route";
import { ScheduleRoutes } from "../module/schedule/schedule.route";

export const router = Router();

const moduleRoutes = [
	{
		path: "/auth",
		route: AuthRoutes,
	},
	{
		path: "/user",
		route: UserRoute,
	},
	{
		path: "/appointment",
		route: AppointMentRoute,
	},
	{
		path: "/doctor",
		route: DoctorRoute,
	},
	{
		path: "/schedule",
		route: ScheduleRoutes,
	},
];

moduleRoutes.forEach((route) => {
	router.use(route.path, route.route);
});
