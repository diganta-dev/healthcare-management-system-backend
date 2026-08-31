import { addDays, differenceInMinutes, startOfDay } from "date-fns";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { ICreateSchedulePayload, IUpdateSchedulePayload } from "./schedule.interface";
import httpStatus from "http-status";
import { RequestUser } from "../../middleware/checkAuth";
import { IQuery } from "../../interfaces/global.interface";
import { scheduleWhereInput } from "../../../generated/prisma/models";
import { ScheduleStatus } from "../../../generated/prisma/enums";

const createSchedule = async (
	payload: ICreateSchedulePayload,
	doctorId: string,
) => {
	const doctor = await prisma.doctor.findUnique({
		where: {
			userId: doctorId,
		},
	});
	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
	}
	const startOftheDay = startOfDay(payload.startDateTime);
	const startofTheNextDay = addDays(startOftheDay, 1);

	const existingScheduleOnSameDate = await prisma.schedule.findFirst({
		where: {
			doctorId: doctor.id,
			isDeleted: false,
			startDateTime: {
				gte: startOftheDay,
				lt: startofTheNextDay,
			},
		},
	});

	if (existingScheduleOnSameDate) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Schedule already exists for the selected date",
		);
	}

	const durationInMinutes = differenceInMinutes(
		payload.startDateTime,
		payload.endDateTime,
	);
	const MINUTES_ALLOCATED_PER_SLOT = 20;
	const totalSlots = Math.floor(durationInMinutes / MINUTES_ALLOCATED_PER_SLOT);
	const schedule = await prisma.schedule.create({
		data: {
			startDateTime: payload.startDateTime,
			endDateTime: payload.endDateTime,
			meetingLink: payload.meetingLink,
			doctorId: doctor.id,
			totalSlots: totalSlots,
			availableSlots: totalSlots,
		},
		include: {
			doctor: true,
		},
	});
	return schedule;
};

const getMySchedule = async (query: IQuery, user: RequestUser) => {
      
    const doctor = await prisma.doctor.findUnique({
        where: {
            userId: user.userId,
        },
    });
    if (!doctor) {
        throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
    }
    const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const andConditions: scheduleWhereInput[] = [
        {
            doctorId: doctor.id
        },
        {
            isDeleted: false
        }
    ];
    if(query.status){
        andConditions.push({
            status: query.status 
        });
    }
    const schedules = await prisma.schedule.findMany({
        where: {
            AND: andConditions.length > 0 ? andConditions : undefined,
        },  
        take: limit,
        skip: skip,
        orderBy: {
            startDateTime: "desc"
        },
        include:{
           appointments:{
            include:{
                patient:true
            }
           }
        }
        
    })

}   

const getAllSchedules = async (query: IQuery, user: RequestUser) => {
    const doctor = await prisma.doctor.findUnique({
        where: {
            userId: user.userId,
        },
    });
    if (!doctor) {
        throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
    }
    const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    
    const andConditions: scheduleWhereInput[] = [];
    if(query.doctorId){
        andConditions.push({
            doctorId: query.doctorId
        });
    }
    if(query.email){
        andConditions.push({
            doctor:{
                email: query.email
            }
        })
    }
    if(query.status){
        andConditions.push({
            status: query.status 
        });
    }
    if(query.searchTerm){
        andConditions.push({
            doctor:{
                OR:[
                    {name:{contains:query.searchTerm,mode:"insensitive"}},
                    {email:{contains:query.searchTerm,mode:"insensitive"}},
                    {
                        specialization:{contains:query.searchTerm,mode:"insensitive"}
                    }
                ]
            }
        })
    }
    const schedules = await prisma.schedule.findMany({
        where: {
            AND: andConditions.length > 0 ? andConditions : undefined,
        },  
        take: limit,
        skip: skip,
        orderBy: {
            startDateTime: "desc"
        },
        include:{
           appointments:{
            include:{
                patient:true
            }
           },
           doctor:true
        }
        
    })
    return schedules;

    
}
const getScheduleById = async (scheduleId: string) => {
    const schedule = await prisma.schedule.findUnique({
        where: {
            id: scheduleId
        },
        include:{
            doctor:true,
            appointments:{
                include:{
                    patient:true
                }
            }
        }
    })
    if(!schedule){
        throw new AppError(httpStatus.NOT_FOUND,"Schedule not found");
    }
    if(schedule.isDeleted){
        throw new AppError(httpStatus.NOT_FOUND,"Schedule not found");
    }
    return schedule;
}

const updateSchedule = async (scheduleId: string, payload: IUpdateSchedulePayload,doctorId: string) => {
    const doctor = await prisma.doctor.findUnique({
        where: {
            userId: doctorId,
        },
    });
    if (!doctor) {
        throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
    }
    const schedule = await prisma.schedule.findUnique({
        where: {
            id: scheduleId ,
            doctorId: doctor.id
        }
    })
    if(!schedule){
        throw new AppError(httpStatus.NOT_FOUND,"Schedule not found");
    }
    if(schedule.doctorId !== doctor.id){
        throw new AppError(httpStatus.FORBIDDEN,"You are not authorized to update this schedule");
    }
    if(schedule.isDeleted){
        throw new AppError(httpStatus.NOT_FOUND,"Schedule not found");
    }
    if(schedule.status === ScheduleStatus.PUBLISHED && schedule.availableSlots !== schedule.totalSlots){
        throw new AppError(httpStatus.BAD_REQUEST,"Cannot update a published schedule and appointments have been booked");
    }
    payload.meetingLink = payload.meetingLink || schedule.meetingLink! ;
    payload.startDateTime = payload.startDateTime || schedule.startDateTime;
    payload.endDateTime = payload.endDateTime || schedule.endDateTime;
    const startOftheDay = startOfDay(payload.startDateTime);
	const startofTheNextDay = addDays(startOftheDay, 1);

	const existingScheduleOnSameDate = await prisma.schedule.findFirst({
		where: {
			doctorId: doctor.id,
			isDeleted: false,
			startDateTime: {
				gte: startOftheDay,
				lt: startofTheNextDay,
			},
		},
	});

	if (existingScheduleOnSameDate) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Schedule already exists for the selected date",
		);
	}
 
    const durationInMinutes = differenceInMinutes(
		payload.startDateTime,
		payload.endDateTime,
	);
	const MINUTES_ALLOCATED_PER_SLOT = 20;
	const totalSlots = Math.floor(durationInMinutes / MINUTES_ALLOCATED_PER_SLOT);

    const updatedSchedule = await prisma.schedule.update({
        where: {
            id: schedule.id,
            doctorId: doctor.id
        },
        data: {
            meetingLink: payload.meetingLink,
            startDateTime: payload.startDateTime,
            endDateTime: payload.endDateTime,
            totalSlots: totalSlots,
            availableSlots: totalSlots,

        },
        include: {
            doctor: {
                select: {
                    name: true,
                    email: true,
                    contactNumber: true,
                }
            }
        }
    })
    return updatedSchedule;
}

const publishSchedule = async (scheduleId: string, doctorId: string) => {
    const doctor = await prisma.doctor.findUnique({
        where: {
            userId: doctorId,
        },
    });
    if (!doctor) {
        throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
    }
    const schedule = await prisma.schedule.findUnique({
        where: {
            id: scheduleId ,
            doctorId: doctor.id
        }
    })
    if(!schedule){
        throw new AppError(httpStatus.NOT_FOUND,"Schedule not found");
    }
    if(schedule.doctorId !== doctor.id){
        throw new AppError(httpStatus.FORBIDDEN,"You are not authorized to publish this schedule");
    }
    if(schedule.isDeleted){
        throw new AppError(httpStatus.NOT_FOUND,"Schedule not found");
    }
    if(schedule.status === ScheduleStatus.PUBLISHED){
        throw new AppError(httpStatus.BAD_REQUEST,"Schedule is already published");
    }
    const publishedSchedule = await prisma.schedule.update({
        where: {
            id: schedule.id,
            doctorId: doctor.id
        },
        data: {
            status: ScheduleStatus.PUBLISHED
        },
        include: {
            doctor: {
                select: {
                    name: true,
                    email: true,
                    contactNumber: true,
                }
            }
        }
    })
    return publishedSchedule;
}
const deleteSchedule = async (scheduleId: string, doctorId: string) => {
    const doctor = await prisma.doctor.findUnique({
        where: {
            userId: doctorId,
        },
    });
    if (!doctor) {
        throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
    }
    const schedule = await prisma.schedule.findUnique({
        where: {
            id: scheduleId ,
            doctorId: doctor.id
        }
    })
    if(!schedule){
        throw new AppError(httpStatus.NOT_FOUND,"Schedule not found");
    }
    if(schedule.doctorId !== doctor.id){
        throw new AppError(httpStatus.FORBIDDEN,"You are not authorized to delete this schedule");
    }
    if(schedule.status === ScheduleStatus.PUBLISHED && schedule.availableSlots !== schedule.totalSlots){
        throw new AppError(httpStatus.BAD_REQUEST,"Cannot delete a published schedule and appointments have been booked");
    }
    if(schedule.isDeleted){
        throw new AppError(httpStatus.NOT_FOUND,"Schedule not found");
    }
    const deletedSchedule = await prisma.schedule.update({
        where: {
            id: schedule.id,
            doctorId: doctor.id
        },
        data: {
            isDeleted: true,
            deletedAt: new Date()
        },
        include: {
            doctor: {
                select: {
                    name: true,
                    email: true,
                    contactNumber: true,
                }
            }
        }
    })
    return deletedSchedule;
}




export const ScheduleService = {
	createSchedule,
    getMySchedule,
    getAllSchedules,
    getScheduleById,
    updateSchedule,
    publishSchedule,
    deleteSchedule
};


