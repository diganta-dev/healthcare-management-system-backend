import { createClient } from "redis";
import config from "../config";

const redisPort = config.redis_port ? Number(config.redis_port) : undefined;
const isTls =
	process.env.REDIS_TLS === "true" ||
	Boolean(config.redis_host && config.redis_host.includes("upstash.io"));

const socketOptions = isTls
	? {
			host: config.redis_host || "127.0.0.1",
			port: redisPort,
			tls: true as const,
		}
	: {
			host: config.redis_host || "127.0.0.1",
			port: redisPort,
		};

const redisClient = config.redis_url
	? createClient({ url: config.redis_url })
	: createClient({
			username: config.redis_username || undefined,
			password: config.redis_password || undefined,
			socket: socketOptions,
		});

redisClient.on("error", (err) => {
	console.error("Redis Client Error:", err.message);
});

export default redisClient;

