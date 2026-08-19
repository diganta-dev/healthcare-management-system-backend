import { Router } from "express";
import { AuthRoutes } from "../module/auth/auth.route";
import { UserRoute } from "../module/user/user.route";

export const router = Router();

const moduleRoutes = [
	{
		path: "/auth",
		route: AuthRoutes,
	},{
		path: "/user",
		route: UserRoute,
	}
];

moduleRoutes.forEach((route) => {
	router.use(route.path, route.route);
});
