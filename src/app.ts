import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
	type Application,
	type Request,
	type Response,
} from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { router } from "./app/router";

const app: Application = express();

app.use(
	cors({
		// ✅ Support multiple origins: local dev + deployed frontend
		origin: (origin, callback) => {
			const allowedOrigins = [
				config.frontend_url,
				"https://health-care-frontend-inky.vercel.app",
			].filter(Boolean) as string[];

			// Allow requests with no origin (e.g. mobile apps, curl, Postman)
			if (!origin || allowedOrigins.includes(origin)) {
				callback(null, true);
			} else {
				callback(new Error(`CORS: Origin '${origin}' is not allowed`));
			}
		},
		credentials: true,
	}),
);

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1", router);

// Basic route
app.get("/", async (req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to PH Healthcare System Backend",
	});
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
