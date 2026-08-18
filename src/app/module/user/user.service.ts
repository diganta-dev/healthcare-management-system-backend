import { UploadApiResponse } from "cloudinary";
import { cloudinaryConfig } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";

const uploadProfileImage = async (buffer: Buffer, userId: string) => {
  const cloudinaryResult = await new Promise<UploadApiResponse>((resolve, reject) => {
    cloudinaryConfig.uploader.upload_stream(
      {
        resource_type: "auto",
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        if (!result) {
          return reject(new Error("Upload failed: no result returned"));
        }
        resolve(result);
      }
    ).end(buffer);
  });

  const updatedUser =await prisma.user.update({
    where: { id: userId },
    data: {
      imageUrl: cloudinaryResult.secure_url,
      imagePublicId: cloudinaryResult.public_id,
    },
  });
  return updatedUser;
 
}

export const UserService = {
	uploadProfileImage,
};