import bcrypt from "bcryptjs";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import {
	Role,
	UserStatus,
	AuthProvider,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { jwtUtils } from "../../utils/jwt";
import type {
	IForgotPasswordPayload,
	ILoginUserPayload,
	IRegisterPatientPayload,
	IRequestUser,
	IResetPasswordPayload,
	IVerifyRegistrationEmailPayload,
} from "./auth.interface";
import type { TokenPayload } from "google-auth-library";
import { googleClient } from "../../lib/googleAuth";
import crypto from "crypto";
import redisClient from "../../lib/redis";
import { transporter } from "../../lib/nodemailer";
import path from "path";
import ejs from "ejs";

const registerPatient = async (payload: IRegisterPatientPayload) => {
	const { name, password, patient: patientData } = payload;
	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExists) {
		throw new Error("User with this email already exists");
	}

	const hashedPassword = await bcrypt.hash(
		password,
		Number(config.bcrypt_salt_rounds),
	);
	const otp = crypto.randomInt(100000, 999999).toString();
	// Here you can send the OTP to the user's email using your preferred email service
	const expirationSeconds = 5 * 60;
	const key = `register-verify-otp:${email}`;
	await redisClient.set(key, otp, {
		expiration: {
			type: "EX",
			value: expirationSeconds, // 5 minutes in seconds
		},
	});

	const redisPayloadUserData={
		name,
		email,
		password: hashedPassword,
		patient:patientData,
	}
	const redisPayload = JSON.stringify(redisPayloadUserData);
	const userRegistrationKey = `register-user:${email}`;
	await redisClient.set(userRegistrationKey, redisPayload, {
		expiration: {
			type: "EX",
			value: expirationSeconds, // 5 minutes in seconds
		},
	}); 
	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/user-registration-otp.ejs",
	);
	const templateData = {
		name: name,
		otp:otp
	};
	const html = await ejs.renderFile(templatePath, templateData);
	await transporter.sendMail({
		from: config.SENDER_EMAIL_USER,
		to: email,
		subject: "Registration verification",  
		html: html,
	});

     

	 
};
const verifyRegistrationEmail = async (payload: IVerifyRegistrationEmailPayload) => {
	const {email,otp}=payload;
	const user = await prisma.user.findUnique({
		where: { email },
	});

	if (user) {
		if(user.emailVerified){
			throw new Error("User email is already verified");
		}
		if (user.status === UserStatus.BLOCKED) {
			throw new Error("User is blocked");
		}

		if (user.isDeleted || user.status === UserStatus.DELETED) {
			throw new Error("User is deleted");
		}
	}
	//redis key for otp verification
	const redisOtp = await redisClient.get(`register-verify-otp:${email}`);
	if (!redisOtp) {
		throw new Error("Invalid or expired OTP");
	}
	if(redisOtp !== otp){
		throw new Error("Invalid OTP");
	}
    // redis key for user registration data
	const redisUserData = await redisClient.get(`register-user:${email}`);
	if (!redisUserData) {
		throw new Error("User registration data not found or expired");
	}

	const userData: IRegisterPatientPayload = JSON.parse(redisUserData);
	
	const createdUser = await prisma.user.create({
		data: {
			name: userData.name,
			email: userData.email,
			password: userData.password,
			role: Role.PATIENT,
			status: UserStatus.ACTIVE,
			emailVerified: true,
			patient: {
				create: {
					name: userData.name,
					email: userData.email,
					...(userData.patient?.contactNumber && {
						contactNumber: userData.patient.contactNumber,
					}),
				},
			},
		},
		omit: { password: true },
		include: { patient: true },
	});

	await redisClient.del(`register-verify-otp:${email}`);
	await redisClient.del(`register-user:${email}`);
	// Send a confirmation email to the user after successful registration
	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/welcome-email.ejs",
	);
	const templateData = {
		name: createdUser.name,
		appName: config.app_name,
	};
	const html = await ejs.renderFile(templatePath, templateData);
	await transporter.sendMail({
		from: config.SENDER_EMAIL_USER,
		to: email,
		subject: "Welcome to " + config.app_name,  
		html: html,
	});

	const { patient, ...users } = createdUser;
	const jwtPayload = {
		userId: users.id,
		name: users.name,
		email: users.email,
		role: users.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		user: users,
		patient,
		accessToken,
		refreshToken,
	};

}

const loginUser = async (payload: ILoginUserPayload) => {
	const { password } = payload;
	const email = payload.email.trim().toLowerCase();

	const user = await prisma.user.findUnique({
		where: { email },
	});

	if (!user) {
		throw new Error("User not found");
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new Error("User is blocked");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new Error("User is deleted");
	}
	if (user.password === null && user.googleId !== null) {
		throw new Error(
			"User is registered with Google. Please login with Google.",
		);
	}

	const isPasswordMatched = await bcrypt.compare(
		password,
		user.password as string,
	);

	if (!isPasswordMatched) {
		throw new Error("Invalid credentials");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};
const googleLogin = async (token: string) => {
  let googleIdTokenPayload: TokenPayload | undefined | null = null;

  // 1. Verify Google ID Token
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: config.google_client_id,
    });

    googleIdTokenPayload = ticket.getPayload();
  } catch (error) {
    console.log("Google ID Token verification failed:", error);
    throw new Error("Invalid or expired Google token");
  }

  // 2. Validate Google payload
  if (!googleIdTokenPayload) {
    throw new Error("Invalid or expired Google ID token");
  }

  if (!googleIdTokenPayload.email) {
    throw new Error("Google email not found");
  }

  if (!googleIdTokenPayload.name) {
    throw new Error("Google user name not found");
  }

  // 3. Find user using Google authentication
  const isPatientExistsGoogleAuth = await prisma.user.findUnique({
    where: {
      email: googleIdTokenPayload.email,
      role: Role.PATIENT,
      googleId: googleIdTokenPayload.sub,
    },
  });

  let user = isPatientExistsGoogleAuth;

  // 4. If Google user doesn't exist
  if (!user) {
    // 5. Check if the user already exists with credential authentication
    const isPatientExistsWithCredentialAuth =
      await prisma.user.findUnique({
        where: {
          email: googleIdTokenPayload.email,
          role: Role.PATIENT,
          authProvider: AuthProvider.CREDENTIAL,
        },
      });

    // 6. Existing credential user
    if (isPatientExistsWithCredentialAuth) {
      if (!isPatientExistsWithCredentialAuth.emailVerified) {
        throw new Error("User email is not verified");
      }

      if (
        isPatientExistsWithCredentialAuth.isDeleted ||
        isPatientExistsWithCredentialAuth.status === UserStatus.DELETED
      ) {
        throw new Error("User is deleted");
      }

      if (
        isPatientExistsWithCredentialAuth.status === UserStatus.BLOCKED
      ) {
        throw new Error("User is blocked");
      }

      // Link Google account with existing credential account
      user = await prisma.user.update({
        where: {
          id: isPatientExistsWithCredentialAuth.id,
        },
        data: {
          googleId: googleIdTokenPayload.sub,
          authProvider: AuthProvider.GOOGLE,
        },
      });
    } else {
      // 7. Create new Google user
      user = await prisma.user.create({
        data: {
          name: googleIdTokenPayload.name,
          email: googleIdTokenPayload.email,
          googleId: googleIdTokenPayload.sub,
          role: Role.PATIENT,
          emailVerified: true,
          authProvider: AuthProvider.GOOGLE,

          patient: {
            create: {
              name: googleIdTokenPayload.name,
              email: googleIdTokenPayload.email,
            },
          },
        },
      });
	  const templatePath = path.join(
		process.cwd(),
		"src/app/templates/welcome-email.ejs",
	);
	const templateData = {
		name: user.name,
		appName: config.app_name,
	};
	const html = await ejs.renderFile(templatePath, templateData);
	await transporter.sendMail({
		from: config.SENDER_EMAIL_USER,
		to: user.email,
		subject: "Welcome to " + config.app_name,  
		html: html,
	});
    }
  }

  // 8. Make sure user exists
  if (!user) {
    throw new Error("User not found");
  }

  // 9. Check blocked user
  if (user.status === UserStatus.BLOCKED) {
    throw new Error("User is blocked");
  }

  // 10. Check deleted user
  if (
    user.isDeleted ||
    user.status === UserStatus.DELETED
  ) {
    throw new Error("User is deleted");
  }

  // 11. Create JWT payload
  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  // 12. Create access token
  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  // 13. Create refresh token
  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  // 14. Return tokens
  return {
    accessToken,
    refreshToken,
  };
};

const getMe = async (user: IRequestUser) => {
	const isUserExists = await prisma.user.findUnique({
		where: {
			id: user.userId,
		},
		include: {
			patient: true,
		},
		omit: {
			password: true,
		},
	});

	if (!isUserExists) {
		throw new Error("User not found");
	}

	return isUserExists;
};

const refreshToken = async (token: string) => {
	const verifiedRefreshToken = jwtUtils.verifyToken(
		token,
		config.jwt_refresh_secret,
	);

	if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
		throw new Error(
			config.node_env === "development"
				? verifiedRefreshToken.error
				: "Invalid refresh token",
		);
	}

	const data = verifiedRefreshToken.data as JwtPayload;

	const user = await prisma.user.findUnique({
		where: { id: data.userId },
	});

	if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
		throw new Error("User is inactive or not found");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};
const forgotPassword = async (payload: IForgotPasswordPayload) => {
	const { email } = payload;
	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});
	if (!isUserExists) {
		throw new Error("User not found");
	}
	if (!isUserExists.emailVerified) {
		throw new Error("User Not Verified");
	}
	if (isUserExists.provider !== AuthProvider.CREDENTIAL) {
		throw new Error(
			"User is registered with Google. Please login with Google.",
		);
	}
	if (isUserExists.status === UserStatus.BLOCKED) {
		throw new Error("User is blocked");
	}
	if (isUserExists.isDeleted || isUserExists.status === UserStatus.DELETED) {
		throw new Error("User is deleted");
	}

	const otp = crypto.randomInt(100000, 999999).toString();
	// Here you can send the OTP to the user's email using your preferred email service
	const expirationSeconds = 5 * 60;
	const key = `forgot-password-otp:${isUserExists.email}`;
	await redisClient.set(key, otp, {
		expiration: {
			type: "EX",
			value: expirationSeconds, // 5 minutes in seconds
		},
	});

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/forget-password.ejs",
	);
	const templateData = {
		name: isUserExists.name,
		email: isUserExists.email,
		otp,
		appName: config.app_name,
		expiresIn: "5 minutes",
	};

	const html = await ejs.renderFile(templatePath, templateData);

	await transporter.sendMail({
		from: config.SENDER_EMAIL_USER,
		to: isUserExists.email,
		subject: "Password Reset OTP",
		html: html,
	});
};
const resetPassword = async (payload: IResetPasswordPayload) => {
	const { email, newPassword, otp } = payload;
	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});
	if (!isUserExists) {
		throw new Error("User not found");
	}
	if (!isUserExists.emailVerified) {
		throw new Error("User Not Verified");
	}
	if (isUserExists.provider !== AuthProvider.CREDENTIAL) {
		throw new Error(
			"User is registered with Google. Please login with Google.",
		);
	}
	if (isUserExists.status === UserStatus.BLOCKED) {
		throw new Error("User is blocked");
	}
	if (isUserExists.isDeleted || isUserExists.status === UserStatus.DELETED) {
		throw new Error("User is deleted");
	}
	const key = `forgot-password-otp:${isUserExists.email}`;
	const storedOtp = await redisClient.get(key);
	if (!storedOtp) {
		throw new Error("Invalid OTP");
	}
	if (storedOtp !== otp) {
		throw new Error("OTP does not match");
	}
	const hashedPassword = await bcrypt.hash(
		newPassword,
		Number(config.bcrypt_salt_rounds),
	);
	await prisma.user.update({
		where: { email: isUserExists.email },
		data: {
			password: hashedPassword,
		},
	});
	await redisClient.del(key);
	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/reset-password-success.ejs",
	);
	const templateData = {
		name: isUserExists.name,
		appName: config.app_name,
	};
	const html = await ejs.renderFile(templatePath, templateData);
	await transporter.sendMail({
		from: config.SENDER_EMAIL_USER,
		to: isUserExists.email,
		subject: "Password Reset Successful",
		html: html,
	});
};

export const AuthService = {
	registerPatient,
	verifyRegistrationEmail,
	loginUser,
	getMe,
	refreshToken,
	googleLogin,
	forgotPassword,
	resetPassword,
};
