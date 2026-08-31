import { addDays, differenceInMinutes, startOfDay } from "date-fns";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { ICreateSchedulePayload } from "./schedule.interface";
import httpStatus from "http-status";
import { RequestUser } from "../../middleware/checkAuth";
import { IQuery } from "../../interfaces/global.interface";
import { scheduleWhereInput } from "../../../generated/prisma/models";

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

	const existingScheduleOnSameDay = await prisma.schedule.findFirst({
		where: {
			doctorId: doctor.id,
			isDeleted: false,
			startDateTime: {
				gte: startOftheDay,
				lt: startofTheNextDay,
			},
		},
	});

	if (existingScheduleOnSameDay) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Schedule already exists for the selected day",
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




export const ScheduleService = {
	createSchedule,
    getMySchedule,
    getAllSchedules,
    getScheduleById
};


