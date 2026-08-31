export interface ICreateSchedulePayload {
	startDateTime: Date;
	endDateTime: Date;
	meetingLink: string;
}
export interface IUpdateSchedulePayload {
	startDateTime?: Date;
	endDateTime?: Date;
	meetingLink?: string;
}
