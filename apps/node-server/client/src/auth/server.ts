import { z } from "zod";


export const ClientMessageDataType = z.object({
    trigger: z.string(),
    uuid: z.string(),
    type: z.string(),
    payload: z.any(),
    credentials: z.object({
        ip: z.string(),
        language: z.enum(['nodejs', 'python']),
        roles: z.array(z.string()).optional(),
        secretKey: z.string(),
    })
})
