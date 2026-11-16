import { z } from 'zod';

export const inquirySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().max(254).pipe(z.email()),
  phone: z.string().trim().max(40).refine(value => value.replace(/\D/g, '').length >= 7),
  address: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(4000),
});

export type Inquiry = z.infer<typeof inquirySchema>;
