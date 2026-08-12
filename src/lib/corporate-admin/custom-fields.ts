import type {
  AdministrativeCustomFieldScope,
  AdministrativeCustomFieldType,
  Prisma,
} from "@/generated/prisma/client";
import { db } from "@/lib/db";

type DbClient = Prisma.TransactionClient | typeof db;

type FieldDefinition = {
  key: string;
  label: string;
  dataType: AdministrativeCustomFieldType;
  required: boolean;
  options: Prisma.JsonValue | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

function normalizeOne(definition: FieldDefinition, value: unknown): Prisma.InputJsonValue {
  if (definition.dataType === "BOOLEAN") {
    if (typeof value !== "boolean") throw new Error(`${definition.label} must be yes/no`);
    return value;
  }

  if (definition.dataType === "NUMBER") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`${definition.label} must be a number`);
    }
    return value;
  }

  if (typeof value !== "string") throw new Error(`${definition.label} must be text`);
  const text = value.trim();

  if (definition.dataType === "DATE" && !isValidDateOnly(text)) {
    throw new Error(`${definition.label} must use YYYY-MM-DD`);
  }
  if (definition.dataType === "URL") {
    try {
      new URL(text);
    } catch {
      throw new Error(`${definition.label} must be a valid URL`);
    }
  }
  if (definition.dataType === "EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    throw new Error(`${definition.label} must be a valid email address`);
  }
  if (definition.dataType === "SELECT") {
    const options = Array.isArray(definition.options)
      ? definition.options.filter((option): option is string => typeof option === "string")
      : [];
    if (!options.includes(text)) throw new Error(`${definition.label} must use one of its configured options`);
  }

  return text;
}

/**
 * Validate and normalise record-level customFields against active field definitions.
 * Unknown keys are rejected: users extend the schema through Custom fields settings instead
 * of silently creating inconsistent one-off keys.
 */
export async function validateAdministrativeCustomFields(
  scope: AdministrativeCustomFieldScope,
  input: unknown,
  client: DbClient = db,
): Promise<Prisma.InputJsonObject> {
  const definitions = await client.administrativeCustomFieldDefinition.findMany({
    where: { scope, isActive: true },
    select: { key: true, label: true, dataType: true, required: true, options: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });

  const source = input == null ? {} : input;
  if (!isObject(source)) throw new Error("Custom fields must be an object");

  const byKey = new Map(definitions.map((definition) => [definition.key, definition]));
  for (const key of Object.keys(source)) {
    if (!byKey.has(key)) throw new Error(`Unknown custom field: ${key}`);
  }

  const output: Record<string, Prisma.InputJsonValue> = {};
  for (const definition of definitions) {
    const value = source[definition.key];
    const empty = value == null || value === "";
    if (empty) {
      if (definition.required) throw new Error(`${definition.label} is required`);
      continue;
    }
    output[definition.key] = normalizeOne(definition, value);
  }
  return output as Prisma.InputJsonObject;
}
