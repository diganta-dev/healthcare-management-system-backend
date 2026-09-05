export interface IMedicene {
	name: string,
	dosage: string,
	duration: string,
	instructions?: string
}
export interface IPrescriptionPayload {
	appointmentId: string,
	findings: string,
	medicines: IMedicene[],
}