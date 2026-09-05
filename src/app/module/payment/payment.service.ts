import { Role } from "../../../generated/prisma/enums";
import { PaymentWhereInput } from "../../../generated/prisma/models";
import { IQuery } from "../../interfaces/global.interface"
import { prisma } from "../../lib/prisma"
import { RequestUser } from "../../middleware/checkAuth"


const getMyPayment = async(query:IQuery,user:RequestUser)=>{
     const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	
      const patient = await prisma.patient.findUnique({
        where:{
            userId:user.userId
        },

      })
      if(!patient){
        throw new Error("Patient not found")
      }
      const andConditions:PaymentWhereInput[] = [
        {
            appointment:{
                patientId:patient.id
            }
        }
      ]

      const payments = await prisma.payment.findMany({
        where:{
            AND: andConditions
        },
        skip: skip,
        take: limit,
        orderBy:{
            createdAt:"desc"
        },
        include:{
            appointment:{
                include:{
                    doctor:{
                        select:{id:true,name:true,email:true,specialization:true}
                    }
                }
            }
        }
      })

       const totalPayments = await prisma.payment.count({
        where:{
            AND: andConditions
        }
      })    
      return {page,limit, payments, totalPayments , totalPages: Math.ceil(totalPayments / limit)};
    }

const getAllPayments = async(query:IQuery)=>{
      const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	
      
      const andConditions:PaymentWhereInput[] = []
      if(query.email){
        andConditions.push({
           
            appointment: {
              patient: {
                email:query.email
              }
            
          }
        })
      }

      const payments = await prisma.payment.findMany({
        where:{
            AND: andConditions
        },
        skip: skip,
        take: limit,
        orderBy:{
            createdAt:"desc"
        },
        include:{
            appointment:{
                include:{
                    doctor:{
                        select:{id:true,name:true,email:true,specialization:true}
                    }
                }
            }
        }
      })

       const totalPayments = await prisma.payment.count({
        where:{
            AND: andConditions
        }
      })  
      return {page,limit, payments, totalPayments , totalPages: Math.ceil(totalPayments / limit)};


}
const getSinglePayment = async(paymentId:string , user:RequestUser)=>{
   const payment = await prisma.payment.findFirst({
        where:{
            id:paymentId, 
            } 
               ,
        include:{appointment:{
            include:{
                
                 patient:{
                    select:{id:true,name:true,email:true}   
                }

            }
        }}
    })
    if(!payment){
        throw new Error("Payment not found")
    }
    if(user.role===Role.PATIENT){
        if(payment.appointment.patient.id !== user.userId){
            throw new Error("You are not authorized to view this payment")
        }
    }
    if(user.role===Role.DOCTOR){
        if(payment.appointment.doctorId !== user.userId){
            throw new Error("You are not authorized to view this payment")
        }
    }
    return payment;

}   

export const PaymentService = {
    getMyPayment,
    getAllPayments,
    getSinglePayment
}