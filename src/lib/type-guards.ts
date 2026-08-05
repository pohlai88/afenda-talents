import { ROLES, type Role } from "@/lib/hiring-roles";
import {
	ROUND_STATUSES,
	STATUSES,
	type RoundStatus,
	type Status,
} from "@/lib/status-constants";

export function isStatus(value: string): value is Status {
	return (STATUSES as readonly string[]).includes(value);
}

export function assertStatus(value: string): asserts value is Status {
	if (!isStatus(value)) {
		throw new Error(`Invalid status: ${value}`);
	}
}

export function parseStatus(value: string): Status {
	assertStatus(value);
	return value;
}

export function isRole(value: string): value is Role {
	return (ROLES as readonly string[]).includes(value);
}

export function assertRole(value: string): asserts value is Role {
	if (!isRole(value)) {
		throw new Error(`Invalid role: ${value}`);
	}
}

export function parseRole(value: string): Role {
	assertRole(value);
	return value;
}

export function isRoundStatus(value: string): value is RoundStatus {
	return (ROUND_STATUSES as readonly string[]).includes(value);
}

export function assertRoundStatus(value: string): asserts value is RoundStatus {
	if (!isRoundStatus(value)) {
		throw new Error(`Invalid round status: ${value}`);
	}
}

export function parseRoundStatus(value: string): RoundStatus {
	assertRoundStatus(value);
	return value;
}
