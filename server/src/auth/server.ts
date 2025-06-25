import { z } from "zod";


export const ClientMessageDataType = z.object({
    trigger: z.string(),
    uuid: z.string(),
    type: z.string(),
    body: z.any(),
    credentials: z.object({
        ip: z.string(),
        language: z.enum(['nodejs', 'python', "*"]),
        secretKey: z.string(),
    })
})
