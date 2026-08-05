import { z } from "zod";
import { ROLES } from "@/lib/hiring-roles";
import { ROUND_STATUSES } from "@/lib/status-constants";

/** Shared client-side parsing for `{ error: string }` API failures. */
export const apiErrorSchema = z.object({
	error: z.string().optional(),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export function apiErrorMessage(
	body: unknown,
	fallback: string,
): string {
	const parsed = apiErrorSchema.safeParse(body);
	return parsed.success && parsed.data.error ? parsed.data.error : fallback;
}

export const userCreateResponseSchema = z.object({
	user: z.object({ email: z.string() }),
	temporaryPassword: z.string(),
});

export const userPatchResponseSchema = z.object({
	ok: z.literal(true).optional(),
	temporaryPassword: z.string().optional(),
});

export const userPatchPayloadSchema = z.object({
	role: z.enum(ROLES).optional(),
	resetPassword: z.boolean().optional(),
});

export type UserPatchPayload = z.infer<typeof userPatchPayloadSchema>;

export const roundPatchPayloadSchema = z.object({
	name: z.string().min(1).max(200).optional(),
	assessmentVersionId: z.string().min(1).optional(),
	status: z.enum(ROUND_STATUSES).optional(),
});

export type RoundPatchPayload = z.infer<typeof roundPatchPayloadSchema>;
