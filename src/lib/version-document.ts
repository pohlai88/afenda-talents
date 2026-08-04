import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
	parseInstrumentDocument,
	type InstrumentDocument,
} from "@/lib/instrument-document";

export async function loadVersionDocument(
	assessmentVersionId: string,
): Promise<InstrumentDocument> {
	const version = await db.assessmentVersion.findUnique({
		where: { id: assessmentVersionId },
		select: { document: true },
	});
	if (!version) throw new Error(`AssessmentVersion not found: ${assessmentVersionId}`);
	return parseInstrumentDocument(version.document);
}

export function documentAsJson(doc: InstrumentDocument): Prisma.InputJsonValue {
	return doc as unknown as Prisma.InputJsonValue;
}
