import type { RequestUser } from "../../middleware/checkAuth";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ScheduleService } from "./schedule.service";

const createSchedule = catchAsync(async (req, res) => {
	const user = req.user as RequestUser;
	const schedule = await ScheduleService.createSchedule(req.body, user.userId);
	sendResponse(res, {
		statusCode: 201,
		success: true,
		message: "Schedule created successfully",
		data: schedule,
	});
});

const getMySchedule = catchAsync(async (req, res) => {
	const query = req.query;
	const user = req.user as RequestUser;
	const result = await ScheduleService.getMySchedule(query, user);
	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Schedules retrieved successfully",
		data: result,
	});
});

const getScheduleById = catchAsync(async (req, res) => {
	const { id } = req.params as { id: string };
	const schedule = await ScheduleService.getScheduleById(id);
	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Schedule retrieved successfully",
		data: schedule,
	});
});
const getAllSchedules = catchAsync(async (req, res) => {
    const query = req.query;
    const user = req.user as RequestUser;
    const result = await ScheduleService.getAllSchedules(query, user);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Schedules retrieved successfully",
        data: result,
    });
});

export const ScheduleController = {
    createSchedule,
    getMySchedule,
    getScheduleById,
    getAllSchedules
};


