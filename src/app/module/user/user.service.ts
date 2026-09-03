import type { UploadApiResponse } from "cloudinary";
import httpStatus from "http-status";
import { cloudinaryConfig } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";

const uploadProfileImage = async (buffer: Buffer, userId: string) => {
	const currentUser = await prisma.user.findUnique({
		where: { id: userId },
		select: { imagePublicId: true, imageUrl: true },
	});
	const cloudinaryResult = await new Promise<UploadApiResponse>(
		(resolve, reject) => {
			cloudinaryConfig.uploader
				.upload_stream(
					{
						resource_type: "auto",
					},
					(error, result) => {
						if (error) {
							return reject(error);
						}
						if (!result) {
							return reject(
								new AppError(
									httpStatus.INTERNAL_SERVER_ERROR,
									"Upload failed: no result returned",
								),
							);
						}
						resolve(result);
					},
				)
				.end(buffer);
		},
	);

	const updatedUser = await prisma.user.update({
		where: { id: userId },
		data: {
			imageUrl: cloudinaryResult.secure_url,
			imagePublicId: cloudinaryResult.public_id,
		},
	});
	if (currentUser?.imagePublicId && currentUser?.imageUrl) {
		await cloudinaryConfig.uploader.destroy(currentUser.imagePublicId);
	}
	return updatedUser;
};

export const UserService = {
	uploadProfileImage,
};
