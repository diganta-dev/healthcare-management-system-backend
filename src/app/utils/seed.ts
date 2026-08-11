import bcrypt from "bcryptjs";
import { Role } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";

export const seedSuperAdmin = async () => {
   try {
     const isSuperAdminExists = await prisma.user.findFirst({
        where: {
            role: Role.SUPER_ADMIN,
        },
    });

    if (isSuperAdminExists) {
        console.log("Super Admin already exists");
        return;
    }
    const name = config.super_admin_name;
    const email = config.super_admin_email;
    const password = config.super_admin_password;
    if(!name || !email || !password) {
        throw new Error("Super Admin credentials are not set in the environment variables");
    }

    const hashedPassword = await bcrypt.hash(
        password,
        Number(config.bcrypt_salt_rounds)
    );
    const superAdmin = await prisma.user.create({
        data: {
            name,
            email,
            password: hashedPassword,
            role: Role.SUPER_ADMIN,
            needPasswordChange: false,
            emailVerified: true,
        },
    });

    console.log("Super Admin Created : ", superAdmin);
   } catch (error) {
     console.log("Error Seeding Super Admin : ", error);

        await prisma.user.delete({
            where : {
                email : config.super_admin_email
            }
        })
   }
};