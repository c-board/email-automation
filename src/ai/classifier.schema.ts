import { z } from "zod";
import { CLASSIFICATIONS } from "../types/classification.types.js";

const nullableText = z
  .string()
  .nullable()
  .transform(function (value) {
    if (value === null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

export const emailClassificationModelSchema = z.object({
  classification: z.enum(CLASSIFICATIONS),
  confidence: z.number(),
  company: z.string().nullable(),
  position: z.string().nullable(),
  applicationDate: z.string().nullable(),
  reason: z.string(),
});

export const emailClassificationSchema = z.object({
  classification: z.enum(CLASSIFICATIONS),
  confidence: z.number().min(0).max(1),
  company: nullableText,
  position: nullableText,
  applicationDate: nullableText,
  reason: z.string().trim().min(1),
});

export type EmailClassification = z.infer<typeof emailClassificationSchema>;
