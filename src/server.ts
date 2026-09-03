import app from "./app";
import config from "./app/config";
import { deleteUnverifiedDoctor } from "./app/lib/cron";
import { transporter } from "./app/lib/nodemailer";
import { prisma } from "./app/lib/prisma";
import redisClient from "./app/lib/redis";
import {
	seedSuperAdmin,
	seedTesterAdmin,
	seedTesterDoctor,
} from "./app/utils/seed";

const PORT = config.port;

const main = async () => {
	try {
		await prisma.$connect();
		console.log("Connected to the database successfully.");
		await redisClient.connect();
		console.log("Connected to Redis successfully.");
		await transporter.verify();
		console.log("Node Mailer connected successfully");
		await seedSuperAdmin(); // Seed the super admin user
		await seedTesterAdmin(); // Seed the tester admin user
		await seedTesterDoctor(); // Seed the tester doctor user
		await deleteUnverifiedDoctor(); // Start the cron job to delete unverified doctors
		app.listen(PORT, () => {
			console.log(`Server is running on port ${PORT}`);
		});
	} catch (error) {
		console.error("Error starting the server:", error);
		await prisma.$disconnect();
		process.exit(1);
	}
};

main();
