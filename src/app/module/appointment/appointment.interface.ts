

export interface IAppointmentPayload  {
	scheduleId: string;
};
export interface IPaymentAppointmentPayload  {
	appointmentId: string;
};
export interface IUpdateAppointmentPayload  {
	status:"ONGOING" | "COMPLETED";
}
