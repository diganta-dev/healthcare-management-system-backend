import { z } from "zod";

export const CreateScheduleValidationZodSchema = z
    .object({
        startDateTime: z.coerce.date("Invalid Start Date Time"),
        endDateTime: z.coerce.date("Invalid End Date Time"),
        meetingLink: z.url("Invalid Meeting Link").trim(),
    })

export const UpdateScheduleValidationZodSchema = z
    .object({
        startDateTime: z.coerce.date("Invalid Start Date Time").optional(),
        endDateTime: z.coerce.date("Invalid End Date Time").optional(),
        meetingLink: z.url("Invalid Meeting Link").trim().optional(),
    })