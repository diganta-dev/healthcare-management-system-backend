import cron from 'node-cron';
import { prisma } from './prisma';
import { DoctorVerificationStatus, Role } from '../../generated/prisma/enums';

export const deleteUnverifiedDoctor =async() => {
    
        
   cron.schedule('0 * * * *', async () => {
       try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
       const deleteDoctors = await prisma.user.deleteMany({
        where:{
            role:Role.DOCTOR,
            emailVerified:false,
            createdAt:{
                lt:oneHourAgo
            },
            doctors:{
                verificationStatus:DoctorVerificationStatus.PENDING
            }
        }
       })
       if(deleteDoctors.count>0){ 
          console.log(`Cron : Delete ${deleteDoctors.count} unverified Doctor Applications older than 1 hour`)
       }
       } catch (error) {
        console.error('Error deleting unverified doctors:', error);
       }
        console.log("Unverified Doctor Delete cron schedule (every 1 hours) is running");
      }) 
    
}