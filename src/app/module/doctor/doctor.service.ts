import { UploadApiResponse } from "cloudinary";
import { prisma } from "../../lib/prisma";
import { cloudinaryConfig } from "../../lib/cloudinary";
import { DoctorPayload } from "./doctor.interface";
import { Role, UserStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import bcrypt from "bcryptjs";



const applyDoctor = async (payload: any, resume: Express.Multer.File, additionalFiles: Express.Multer.File[]) => {

    

    const isUserExist = await prisma.user.findUnique({
        where: {
            email: payload.user.email,
        },
    });
    if (isUserExist) {
        throw new Error("User Already Exists");
    }
    // upload resume to cloudinary  
    const resumeResult = await new Promise<UploadApiResponse>(
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
                            return reject(new Error("Upload failed: no result returned"));
                        }
                        resolve(result);
                    },
                )
                .end(resume.buffer);
        },
    );
    // upload additional files to cloudinary
    const additionalFilesResults = await Promise.all(
        additionalFiles.map(
            (file) =>
                new Promise<UploadApiResponse>((resolve, reject) => {
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
                                    return reject(new Error("Upload failed: no result returned"));
                                }
                                resolve(result);
                            },
                        )
                        .end(file.buffer);
                }),
        ),
    );
    const doctorPassowrd = Math.random().toString(36).slice(-8);

    const hashedPassword = await bcrypt.hash(doctorPassowrd, Number(config.bcrypt_salt_rounds));

    const doctorApplication = await prisma.user.create({
        data: {

            ...payload.user,
            role: Role.DOCTOR,
            password: hashedPassword,
            needPasswordChange: true,
            
            doctors: {
                create: {
                    name: payload.user.name,
                    email: payload.user.email,
                    ...payload.doctor,
                    resume: resumeResult.secure_url,
                    resumePublicId: resumeResult.public_id,
                    additionalFiles: additionalFilesResults.map((file) => ({
                        url: file.secure_url,
                        publicId: file.public_id,
                    })),
                },
            },
        },
        include:{
            doctors:true
        }
    })

    return doctorApplication;

}

export const DoctorService = {
    applyDoctor
}