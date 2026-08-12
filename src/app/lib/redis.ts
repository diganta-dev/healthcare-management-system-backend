import { createClient } from 'redis';
import config from '../config';


const redisPort = config.redis_port ? Number(config.redis_port) : undefined;

const redisClient = createClient({
    username: config.redis_username,
    password: config.redis_password,
    socket: {
        host: config.redis_host,
        port: redisPort
    }
});

export default redisClient;