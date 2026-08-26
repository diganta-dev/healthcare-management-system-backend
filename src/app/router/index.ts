import { Router } from "express";
import { AuthRoutes } from "../module/auth/auth.route";
import { UserRoute } from "../module/user/user.route";
import { AppointMentRoute } from "../module/appointment/appointment.route";
import { DoctorRoute } from "../module/doctor/doctor.route";

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
];

moduleRoutes.forEach((route) => {
	router.use(route.path, route.route);
});
