import z from "zod";

export const UpdateAppointmentStatusValidationZodSchema = z.object({
  status: z.enum(["ONGOING", "COMPLETED"]),
});
export const BookAppointmentValidationZodSchema = z.object({
  scheduleId: z.string().min(1, "Schedule ID is required"),
});