import z from 'zod';

const createDoctorScheduleValidation = z.object({
    body: z.object({
        startDate: z.iso.date(),
        endDate: z.iso.date(),
        startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid start time format (HH:mm)"),
        endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid end time format (HH:mm)")
    })
});


export const DoctorScheduleValidation = {
    createDoctorScheduleValidation
}