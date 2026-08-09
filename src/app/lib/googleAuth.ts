import { OAuth2Client } from "google-auth-library";
import config from "../config";

export const googleClient = new OAuth2Client({
	clientId: config.google_client_id,
});
