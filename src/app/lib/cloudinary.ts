import config from "../config";
import { v2 as Cloudinary } from "cloudinary";

Cloudinary.config({
	cloud_name: config.cloudinary_cloud_name,
	api_key: config.cloudinary_api_key,
	api_secret: config.cloudinary_api_secret,
});

export const cloudinaryConfig = Cloudinary;
