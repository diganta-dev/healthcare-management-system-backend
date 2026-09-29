import { createClient } from "redis";
import config from "../config";

export  const redisClient = createClient({
	username: config.redis_username,
	password: config.redis_password,
	socket: {
		host: config.redis_host,
		port: Number(config.redis_port),
	},
});
export default redisClient;