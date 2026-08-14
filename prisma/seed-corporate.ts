/**
 * Corporate Administration seed.
 *
 * CA ships 11+ models and the base seed creates records for none of them, so every
 * CA screen renders its empty state. A blank register looks identical whether the
 * design is good or bad, which makes the UI impossible to judge. This fills the
 * corporate side with enough realistic data to see the screens as an operator does.
 *
 * Deliberate choices:
 * - **Volume.** ~90 obligations, not three. Missing sorting and pagination are
 *   invisible at low volume and obvious at realistic volume.
 * - **Dates are relative to today**, so overdue / due / upcoming always populate
 *   however long after seeding you look.
 * - **Deterministic.** A fixed-seed PRNG, so two runs on two machines produce the
 *   same database and screenshots can be compared.
 * - **Idempotent by sentinel.** If the first counterparty exists the whole seed is
 *   skipped rather than duplicated. Nothing is deleted — D21 ("Corporate corrects
 *   and stands down, it never deletes") applies to the seed too.
 *
 * Domain rules honoured:
 * - UPCOMING / DUE / OVERDUE are derived from `dueDate` at read time and are never
 *   written here; only `OPEN` / `COMPLETED` / `CANCELLED` are persisted.
 * - Inactive records are modelled with `isActive: false`, never by omission.
 * - Approver / requester / reconciler are real user ids, never free text.
 */
import { Prisma, type PrismaClient } from "../src/generated/prisma/client";

/**
 * Work items, reminder deliveries and automation runs are written with raw SQL,
 * not the Prisma model API, because their migrations create `status`/`priority`/
 * `channel`/`jobType` as TEXT with CHECK constraints while the Prisma schema
 * declares them as native enums. Prisma casts to the enum type on insert and the
 * type does not exist in the database, so a model-API create fails with
 * `type "public.AdministrativeWorkItemStatus" does not exist`.
 *
 * This mirrors the application, which already reaches for `$queryRaw`/`$executeRaw`
 * for exactly these tables — see `src/lib/corporate-admin/work-items-server.ts`.
 * The drift is pre-existing and is recorded rather than papered over here.
 */

const SENTINEL_CODE = "CP-0001";

// ---------------------------------------------------------------------------
// Deterministic helpers
// ---------------------------------------------------------------------------

let state = 20260815;
function rnd(): number {
	state = (state * 1103515245 + 12345) & 0x7fffffff;
	return state / 0x7fffffff;
}
function pick<T>(items: readonly T[]): T {
	return items[Math.floor(rnd() * items.length)]!;
}
function int(min: number, max: number): number {
	return min + Math.floor(rnd() * (max - min + 1));
}
function chance(p: number): boolean {
	return rnd() < p;
}
function pad(n: number, width = 4): string {
	return String(n).padStart(width, "0");
}

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function addDays(days: number, from: Date = TODAY): Date {
	const d = new Date(from);
	d.setDate(d.getDate() + days);
	d.setHours(0, 0, 0, 0);
	return d;
}
function addMonths(months: number, from: Date = TODAY): Date {
	const d = new Date(from);
	d.setMonth(d.getMonth() + months);
	d.setHours(0, 0, 0, 0);
	return d;
}
/** `2026-03` style label, which is what the due-item unique key expects. */
function periodLabel(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

const ORGANISATION = "Afenda Group";

const COUNTERPARTIES: Array<{ name: string; type: string; active?: boolean }> = [
	{ name: "Menara Suria Holdings", type: "LANDLORD" },
	{ name: "Peninsular Realty Trust", type: "LANDLORD" },
	{ name: "Bandar Utama Estates", type: "LANDLORD" },
	{ name: "Tenaga Utilities Berhad", type: "UTILITY" },
	{ name: "Selangor Water Services", type: "UTILITY" },
	{ name: "Allianz General Insurance", type: "INSURER" },
	{ name: "Etiqa Takaful", type: "INSURER" },
	{ name: "Atlas Facilities Management", type: "CONTRACTOR" },
	{ name: "Nusantara Cleaning Services", type: "CONTRACTOR" },
	{ name: "Sunrise Fleet Leasing", type: "VENDOR" },
	{ name: "Kuala Lumpur Office Supplies", type: "VENDOR", active: false },
	{ name: "Microsoft Malaysia", type: "LICENSOR" },
	{ name: "Adobe Systems APAC", type: "LICENSOR" },
	// Deliberate near-duplicate of the first entry so Data quality and Cleanup have
	// something real to surface rather than an empty findings table.
	{ name: "Menara Suria Holdings Sdn Bhd", type: "LANDLORD" },
];

const SITES: Array<{ name: string; type: string; city: string; active?: boolean }> = [
	{ name: "Menara Suria HQ", type: "OFFICE", city: "Kuala Lumpur" },
	{ name: "Cyberjaya Delivery Centre", type: "OFFICE", city: "Cyberjaya" },
	{ name: "Shah Alam Warehouse", type: "WAREHOUSE", city: "Shah Alam" },
	{ name: "Penang Regional Office", type: "OFFICE", city: "George Town" },
	{ name: "Johor Distribution Hub", type: "WAREHOUSE", city: "Johor Bahru" },
	{ name: "Mid Valley Retail Unit", type: "RETAIL", city: "Kuala Lumpur" },
	{ name: "Kota Kinabalu Branch", type: "OFFICE", city: "Kota Kinabalu" },
	{ name: "Klang Legacy Store", type: "RETAIL", city: "Klang", active: false },
];

const SERVICE_CATEGORIES = [
	"CLEANING",
	"SECURITY",
	"MAINTENANCE",
	"WASTE_MANAGEMENT",
	"UTILITIES",
	"PEST_CONTROL",
] as const;

const CATEGORIES = [
	"TENANCY",
	"SUBSCRIPTION",
	"INSURANCE",
	"FLEET",
	"MAINTENANCE",
	"LICENCE",
] as const;

const TITLE_BY_CATEGORY: Record<string, readonly string[]> = {
	TENANCY: ["Office lease", "Warehouse lease", "Retail unit tenancy", "Car park lease"],
	SUBSCRIPTION: ["Microsoft 365 subscription", "Adobe Creative Cloud", "Payroll platform", "Helpdesk platform"],
	INSURANCE: ["Fire and perils policy", "Public liability cover", "Group medical cover", "Fleet motor policy"],
	FLEET: ["Company car lease", "Van lease", "Fleet maintenance contract", "Fuel card agreement"],
	MAINTENANCE: ["Lift maintenance", "Air-conditioning servicing", "Fire system inspection", "Generator servicing"],
	LICENCE: ["Business premises licence", "Signage licence", "Fire certificate", "Waste disposal permit"],
};

const PAYMENT_METHODS = ["BANK_TRANSFER", "CHEQUE", "DIRECT_DEBIT", "CORPORATE_CARD"] as const;

const EXTRA_USERS: Array<{ email: string; name: string; role: "ADMIN" | "VIEWER" }> = [
	{ email: "ops.lead@local.test", name: "Faridah Osman", role: "ADMIN" },
	{ email: "finance@local.test", name: "Daniel Tan", role: "ADMIN" },
	{ email: "facilities@local.test", name: "Priya Nair", role: "VIEWER" },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

export async function seedCorporate(db: PrismaClient): Promise<void> {
	const sentinel = await db.administrativeCounterparty.findUnique({
		where: { code: SENTINEL_CODE },
	});
	if (sentinel) {
		console.log("Corporate data already seeded — skipping.");
		return;
	}

	// --- Users -------------------------------------------------------------
	// Ownership variety is what makes "Awaiting me" and "Unassigned" distinguishable
	// on the Control tower; with one user every bucket looks the same.
	const { hashPassword } = await import("../src/lib/passwords");
	const seedPassword = process.env.SEED_USER_PASSWORD ?? "LocalCorporateSeed!2026";
	const passwordHash = hashPassword(seedPassword);

	const users = [];
	for (const u of EXTRA_USERS) {
		users.push(
			await db.user.upsert({
				where: { email: u.email },
				update: {},
				create: { email: u.email, name: u.name, passwordHash, role: u.role },
			}),
		);
	}
	const anyAdmin = await db.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
	if (anyAdmin && !users.some((u) => u.id === anyAdmin.id)) users.unshift(anyAdmin);
	const ownerPool: Array<string | null> = [...users.map((u) => u.id), null];

	// --- Custom field definitions -----------------------------------------
	// showInList drives register columns, so these must exist for the tables to
	// look like a configured workspace rather than a bare default.
	const customFields = [
		{ scope: "OBLIGATION" as const, key: "costCentre", label: "Cost centre", dataType: "TEXT" as const, showInList: true, sortOrder: 1 },
		{ scope: "OBLIGATION" as const, key: "renewalOwner", label: "Renewal owner", dataType: "TEXT" as const, showInList: true, sortOrder: 2 },
		{ scope: "OBLIGATION" as const, key: "boardApproved", label: "Board approved", dataType: "BOOLEAN" as const, showInList: false, sortOrder: 3 },
		{ scope: "COUNTERPARTY" as const, key: "vendorTier", label: "Vendor tier", dataType: "SELECT" as const, showInList: true, sortOrder: 1, options: ["Tier 1", "Tier 2", "Tier 3"] },
		{ scope: "SITE" as const, key: "floorArea", label: "Floor area (sq ft)", dataType: "NUMBER" as const, showInList: true, sortOrder: 1 },
		{ scope: "PAYMENT" as const, key: "poNumber", label: "PO number", dataType: "TEXT" as const, showInList: true, sortOrder: 1 },
	];
	for (const f of customFields) {
		await db.administrativeCustomFieldDefinition.upsert({
			where: { scope_key: { scope: f.scope, key: f.key } },
			update: {},
			create: {
				scope: f.scope,
				key: f.key,
				label: f.label,
				dataType: f.dataType,
				showInList: f.showInList,
				sortOrder: f.sortOrder,
				options: f.options ?? undefined,
				isActive: true,
				createdById: users[0]?.id ?? null,
			},
		});
	}

	// --- Counterparties and contacts --------------------------------------
	const counterparties = [];
	for (const [i, cp] of COUNTERPARTIES.entries()) {
		const created = await db.administrativeCounterparty.create({
			data: {
				code: `CP-${pad(i + 1)}`,
				name: cp.name,
				type: cp.type,
				registrationNo: `${199000 + i}-${pad(int(10, 99), 2)}`,
				contactName: pick(["Aisyah Rahman", "Wong Kar Meng", "Suresh Kumar", "Nurul Huda", "James Lim"]),
				contactEmail: `accounts${i + 1}@example.test`,
				contactPhone: `+60 3-${int(2000, 9999)} ${int(1000, 9999)}`,
				address: `${int(1, 99)} Jalan ${pick(["Ampang", "Bukit Bintang", "Sultan Ismail", "Tun Razak"])}, Kuala Lumpur`,
				countryCode: "MY",
				defaultCurrency: "MYR",
				paymentTermsDays: pick([14, 30, 30, 45, 60]),
				isActive: cp.active ?? true,
				customFields: { vendorTier: pick(["Tier 1", "Tier 2", "Tier 3"]) },
			},
		});
		counterparties.push(created);

		// Two counterparties deliberately get two active primary contacts, which is
		// the conflict the Cleanup workflow exists to resolve.
		const duplicatePrimary = i === 0 || i === 7;
		const contactCount = duplicatePrimary ? 3 : int(1, 2);
		for (let c = 0; c < contactCount; c++) {
			await db.administrativeCounterpartyContact.create({
				data: {
					counterpartyId: created.id,
					name: pick(["Lim Wei Sheng", "Zainab Ismail", "Ravi Chandran", "Chong Mei Ling", "Hafiz Abdullah"]),
					jobTitle: pick(["Account Manager", "Finance Executive", "Operations Lead", "Director"]),
					email: `contact${i + 1}${c + 1}@example.test`,
					phone: `+60 1${int(1, 9)}-${int(100, 999)} ${int(1000, 9999)}`,
					role: pick(["BILLING", "OPERATIONS", "ESCALATION"]),
					isPrimary: duplicatePrimary ? c < 2 : c === 0,
					isActive: true,
				},
			});
		}
	}

	// --- Sites and service coverage ---------------------------------------
	const sites = [];
	for (const [i, s] of SITES.entries()) {
		sites.push(
			await db.administrativeSite.create({
				data: {
					code: `ST-${pad(i + 1)}`,
					name: s.name,
					type: s.type,
					organization: ORGANISATION,
					addressLine1: `${int(1, 200)} Jalan ${pick(["Kerinchi", "Damansara", "Gasing", "Bangsar"])}`,
					city: s.city,
					stateRegion: pick(["Selangor", "Kuala Lumpur", "Penang", "Johor", "Sabah"]),
					postalCode: String(int(40000, 99999)),
					countryCode: "MY",
					timezone: "Asia/Kuala_Lumpur",
					isActive: s.active ?? true,
					customFields: { floorArea: int(1200, 45000) },
				},
			}),
		);
	}

	const contractors = counterparties.filter((c) => c.type === "CONTRACTOR" || c.type === "UTILITY");
	for (const site of sites) {
		for (const category of SERVICE_CATEGORIES.slice(0, int(2, 4))) {
			const provider = pick(contractors);
			await db.administrativeServiceCoverage.create({
				data: {
					siteId: site.id,
					counterpartyId: provider.id,
					serviceCategory: category,
					roleCode: pick(["PRIMARY_PROVIDER", "BACKUP_PROVIDER"]),
					effectiveFrom: addMonths(-int(6, 36)),
					isPrimary: true,
					isActive: true,
					serviceLevel: pick(["8x5", "24x7", "NEXT_BUSINESS_DAY"]),
				},
			});
		}
	}
	// One site gets a second active primary in the same category — the exact
	// duplicate-primary conflict the guided cleanup screen resolves.
	await db.administrativeServiceCoverage.create({
		data: {
			siteId: sites[0]!.id,
			counterpartyId: contractors[1]!.id,
			serviceCategory: SERVICE_CATEGORIES[0],
			roleCode: "PRIMARY_PROVIDER",
			isPrimary: true,
			isActive: true,
			effectiveFrom: addMonths(-4),
		},
	});

	// --- Obligations, lines, due items, payments ---------------------------
	const OBLIGATION_COUNT = 92;
	let dueItemCount = 0;
	let paymentCount = 0;
	let lineCount = 0;
	const endedObligationIds: string[] = [];
	const openDueItemIds: string[] = [];

	for (let i = 0; i < OBLIGATION_COUNT; i++) {
		const category = pick(CATEGORIES);
		const counterparty = pick(counterparties.filter((c) => c.isActive));
		// Weighted so the register looks like a live workspace: mostly ACTIVE, with a
		// realistic tail of drafts, endings and cancellations.
		const roll = rnd();
		const status = roll < 0.66 ? "ACTIVE" : roll < 0.78 ? "DRAFT" : roll < 0.94 ? "ENDED" : "CANCELLED";
		const startDate = addMonths(-int(3, 48));
		const isEnded = status === "ENDED" || status === "CANCELLED";
		const endDate = isEnded ? addMonths(-int(1, 6)) : chance(0.6) ? addMonths(int(2, 24)) : null;
		const recurring = status === "ACTIVE" && chance(0.85);
		const unit = pick(["MONTH", "MONTH", "MONTH", "QUARTER_AS_MONTH", "YEAR"] as const);
		const recurrenceUnit = unit === "YEAR" ? ("YEAR" as const) : ("MONTH" as const);
		const recurrenceInterval = unit === "QUARTER_AS_MONTH" ? 3 : 1;
		const expectedAmount = Number((int(45, 9800) * 10).toFixed(2));

		const obligation = await db.administrativeObligation.create({
			data: {
				code: `OB-${pad(i + 1)}`,
				organization: ORGANISATION,
				category,
				title: `${pick(TITLE_BY_CATEGORY[category]!)} — ${pick(sites).name}`,
				counterpartyId: counterparty.id,
				assetReference: chance(0.4) ? `AST-${pad(int(1, 400))}` : null,
				ownerId: pick(ownerPool),
				status,
				startDate,
				endDate,
				recurring,
				recurrenceInterval: recurring ? recurrenceInterval : null,
				recurrenceUnit: recurring ? recurrenceUnit : null,
				expectedAmount,
				currency: "MYR",
				firstDueDate: startDate,
				autoRenew: chance(0.35),
				renewalDate: endDate ? addDays(-int(30, 90), endDate) : null,
				noticeDays: pick([30, 60, 90]),
				contractRequired: chance(0.7),
				contractReference: chance(0.7) ? `CTR-${pad(i + 1)}` : null,
				paymentMethod: pick(PAYMENT_METHODS),
				notes: chance(0.3) ? "Reviewed at the quarterly operations meeting." : null,
				customFields: {
					costCentre: pick(["CC-100", "CC-210", "CC-330", "CC-450"]),
					renewalOwner: pick(["Faridah Osman", "Daniel Tan", "Priya Nair"]),
					boardApproved: chance(0.25),
				},
			},
		});
		if (status === "ENDED") endedObligationIds.push(obligation.id);

		// Link to a site and record the counterparty as the primary party.
		await db.administrativeObligationSite.create({
			data: { obligationId: obligation.id, siteId: pick(sites).id, scopeRole: "PRIMARY_SITE", isActive: true },
		});
		await db.administrativeObligationParty.create({
			data: {
				obligationId: obligation.id,
				counterpartyId: counterparty.id,
				roleCode: "COUNTERPARTY",
				isPrimary: true,
				isActive: true,
				effectiveFrom: startDate,
			},
		});

		// Every obligation carries the GENERAL compatibility line (CA-03); some carry
		// real component lines on top of it.
		const lines: Array<{ code: string; name: string; lineType: string; amount: number }> = [
			{ code: "GENERAL", name: "General", lineType: "GENERAL", amount: expectedAmount },
		];
		if (category === "TENANCY" && chance(0.8)) {
			lines.push({ code: "RENT", name: "Base rent", lineType: "RENT", amount: Number((expectedAmount * 0.8).toFixed(2)) });
			lines.push({ code: "SERVICE", name: "Service charge", lineType: "SERVICE_CHARGE", amount: Number((expectedAmount * 0.2).toFixed(2)) });
		}

		for (const l of lines) {
			const line = await db.administrativeObligationLine.create({
				data: {
					obligationId: obligation.id,
					code: l.code,
					name: l.name,
					lineType: l.lineType,
					expectedAmount: l.amount,
					currency: "MYR",
					recurring,
					recurrenceInterval: recurring ? recurrenceInterval : null,
					recurrenceUnit: recurring ? recurrenceUnit : null,
					firstDueDate: startDate,
					invoiceRequired: chance(0.6),
					paymentTermsDays: counterparty.paymentTermsDays,
					startDate,
					endDate,
					// The GENERAL compatibility line must never be deactivated (CA-03).
					isActive: l.code === "GENERAL" ? true : !isEnded,
				},
			});
			lineCount++;

			if (status === "DRAFT" || status === "CANCELLED") continue;

			// Due items straddle today on purpose: past periods settled, a band of
			// overdue and imminent work, and future periods scheduled. Attention state
			// is derived from these dates at read time, never stored.
			const step = recurrenceInterval;
			for (let p = -6; p <= 4; p++) {
				const dueDate = addMonths(p * step);
				if (isEnded && dueDate > endDate!) continue;
				const isPast = dueDate < TODAY;
				const settled = isPast && chance(0.72);
				const amount = l.amount;

				const dueItem = await db.obligationDueItem.create({
					data: {
						obligationId: obligation.id,
						lineId: line.id,
						periodLabel: periodLabel(dueDate),
						dueDate,
						expectedAmount: amount,
						invoiceAmount: chance(0.7) ? amount : null,
						currency: "MYR",
						invoiceRequired: chance(0.5),
						invoiceNumber: chance(0.7) ? `INV-${pad(int(1000, 9999))}` : null,
						status: settled ? "COMPLETED" : "OPEN",
						disputeFlag: !settled && isPast && chance(0.08),
						completedDate: settled ? addDays(int(1, 20), dueDate) : null,
					},
				});
				dueItemCount++;
				if (!settled) openDueItemIds.push(dueItem.id);

				// Payments: settled items are fully paid and mostly reconciled; a live
				// band sits at each approval and settlement stage so the payment queue
				// shows every state an operator has to act on.
				if (settled) {
					const approver = pick(users);
					await db.administrativePayment.create({
						data: {
							dueItemId: dueItem.id,
							requestDate: addDays(-int(3, 10), dueDate),
							requestedById: pick(users).id,
							requestedAmount: amount,
							approvalStatus: "APPROVED",
							approvedById: approver.id,
							approvalDate: addDays(-int(1, 3), dueDate),
							approvedAmount: amount,
							paymentStatus: "PAID",
							paymentDate: addDays(int(1, 14), dueDate),
							paidAmount: amount,
							paymentMethod: pick(PAYMENT_METHODS),
							paymentReference: `TRX-${pad(int(100000, 999999), 6)}`,
							reconciledAt: chance(0.75) ? addDays(int(15, 30), dueDate) : null,
							reconciledById: chance(0.75) ? approver.id : null,
							customFields: { poNumber: `PO-${pad(int(1000, 9999))}` },
						},
					});
					paymentCount++;
				} else if (isPast && chance(0.55)) {
					const stage = rnd();
					const partial = stage > 0.75;
					await db.administrativePayment.create({
						data: {
							dueItemId: dueItem.id,
							requestDate: addDays(-int(1, 6), dueDate),
							requestedById: pick(users).id,
							requestedAmount: amount,
							approvalStatus: stage < 0.4 ? "PENDING" : stage < 0.5 ? "REJECTED" : "APPROVED",
							approvedById: stage < 0.4 ? null : pick(users).id,
							approvalDate: stage < 0.4 ? null : addDays(-int(0, 2), dueDate),
							approvedAmount: stage < 0.5 ? null : amount,
							paymentStatus: stage < 0.5 ? "NOT_PAID" : partial ? "PARTIALLY_PAID" : "NOT_PAID",
							paidAmount: partial ? Number((amount * 0.5).toFixed(2)) : null,
							paymentDate: partial ? addDays(int(1, 5), dueDate) : null,
							paymentMethod: partial ? pick(PAYMENT_METHODS) : null,
							customFields: { poNumber: `PO-${pad(int(1000, 9999))}` },
						},
					});
					paymentCount++;
				}
			}
		}
	}

	// A couple of voided payments, so that state is not theoretical on the register.
	for (const dueItemId of openDueItemIds.slice(0, 3)) {
		await db.administrativePayment.create({
			data: {
				dueItemId,
				requestedById: pick(users).id,
				requestedAmount: 1500,
				approvalStatus: "APPROVED",
				approvedById: pick(users).id,
				approvalDate: addDays(-20),
				approvedAmount: 1500,
				paymentStatus: "VOIDED",
				notes: "Voided after a duplicate transfer was identified.",
			},
		});
		paymentCount++;
	}

	// --- Work items and reminders -----------------------------------------
	const WORK_STATUSES = ["OPEN", "OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CANCELLED"] as const;
	const WORK_PRIORITIES = ["LOW", "NORMAL", "NORMAL", "HIGH", "CRITICAL"] as const;
	let workItemCount = 0;
	for (let i = 0; i < 28; i++) {
		const status = pick(WORK_STATUSES);
		const priority = pick(WORK_PRIORITIES);
		const dueDate = addDays(int(-45, 30));
		// Escalation level is a deterministic function of how overdue the item is —
		// it is not random, and the control tower reads it as evidence.
		const overdueDays = Math.floor((TODAY.getTime() - dueDate.getTime()) / 86_400_000);
		const escalationLevel = overdueDays <= 0 ? 0 : overdueDays < 7 ? 1 : overdueDays < 21 ? 2 : 3;
		const resolved = status === "RESOLVED" || status === "CANCELLED";
		const owner = i % 5 === 0 ? null : pick(users);

		const workItemId = `wi_seed_${pad(i + 1)}`;
		const title = pick([
			"Renewal notice due",
			"Invoice missing for settled period",
			"Payment awaiting approval",
			"Duplicate primary contact",
			"Service coverage gap",
			"Contract document not attached",
			"Reconciliation outstanding",
		]);
		const sourceType = pick(["OBLIGATION", "DUE_ITEM", "PAYMENT", "COUNTERPARTY", "DATA_QUALITY"] as const);
		const acknowledged = status === "ACKNOWLEDGED" || status === "IN_PROGRESS";

		await db.$executeRaw(Prisma.sql`
			INSERT INTO "AdministrativeWorkItem" (
				"id","title","description","status","priority","ownerId","sourceType","sourceKey","sourceHref",
				"dueDate","escalationLevel","escalateAfter","escalatedAt","acknowledgedAt","acknowledgedById",
				"resolvedAt","resolvedById","resolutionNote","createdById"
			) VALUES (
				${workItemId}, ${title}, ${"Raised from the operational rules; resolve or reassign."},
				${status}, ${priority}, ${owner?.id ?? null}, ${sourceType},
				${`seed:work:${i + 1}`}, ${"/admin/corporate/obligations"},
				${dueDate}, ${resolved ? 0 : escalationLevel}, ${addDays(7, dueDate)},
				${!resolved && escalationLevel > 0 ? addDays(-int(1, 10)) : null},
				${acknowledged ? addDays(-int(1, 5)) : null}, ${acknowledged ? owner?.id ?? null : null},
				${resolved ? addDays(-int(1, 12)) : null}, ${resolved ? pick(users).id : null},
				${resolved ? "Closed after the underlying record was corrected." : null},
				${users[0]?.id ?? null}
			)
		`);
		workItemCount++;

		if (!resolved && chance(0.5)) {
			await db.$executeRaw(Prisma.sql`
				INSERT INTO "AdministrativeReminderDelivery" (
					"id","workItemId","recipientUserId","channel","status","deliveryKey","subject","body","sentAt","createdById"
				) VALUES (
					${`rd_seed_${pad(i + 1)}`}, ${workItemId}, ${owner?.id ?? null},
					${chance(0.6) ? "IN_APP" : "EMAIL"}, ${pick(["SENT", "SENT", "QUEUED", "FAILED"] as const)},
					${`seed:reminder:${i + 1}`}, ${"Corporate item needs attention"},
					${"An operational item assigned to you is approaching or past its due date."},
					${addDays(-int(1, 6))}, ${users[0]?.id ?? null}
				)
			`);
		}
	}

	// --- Closures and reconciliation --------------------------------------
	let closureCount = 0;
	for (const [i, obligationId] of endedObligationIds.slice(0, 4).entries()) {
		const status = pick(["OPEN", "RECONCILING", "READY", "CLOSED"] as const);
		const closure = await db.administrativeClosure.create({
			data: {
				obligationId,
				status,
				terminationType: pick(["EXPIRED", "TERMINATED", "SURRENDERED"] as const),
				noticeDate: addMonths(-int(4, 8)),
				effectiveDate: addMonths(-int(1, 3)),
				handoverDate: addMonths(-int(0, 2)),
				terminationReason: "Agreement reached its contractual end date.",
				lifecycleManaged: true,
				createdById: users[0]?.id ?? null,
				closedById: status === "CLOSED" ? users[0]?.id ?? null : null,
				closedAt: status === "CLOSED" ? addDays(-int(5, 40)) : null,
			},
		});
		closureCount++;

		for (const category of ["DEPOSIT", "UTILITIES", "REPAIR_MAINTENANCE", "SERVICE_CHARGE"] as const) {
			await db.administrativeReconciliationItem.create({
				data: {
					closureId: closure.id,
					category,
					direction: category === "DEPOSIT" ? "RECEIVABLE" : "PAYABLE",
					description: `${category.replaceAll("_", " ").toLowerCase()} settlement for the final period`,
					expectedAmount: Number((int(20, 900) * 10).toFixed(2)),
					actualAmount: chance(0.6) ? Number((int(20, 900) * 10).toFixed(2)) : null,
					currency: "MYR",
					status: status === "CLOSED" ? "SETTLED" : pick(["OPEN", "OPEN", "SETTLED", "DISPUTED"] as const),
					createdById: users[0]?.id ?? null,
				},
			});
		}
		if (i === 0) {
			// One historical payment so the settlement screen shows the import path
			// as well as the live approval path.
			const dueItemId = openDueItemIds[openDueItemIds.length - 1];
			if (dueItemId) {
				const historical = await db.administrativePayment.create({
					data: {
						dueItemId,
						requestedById: users[0]?.id ?? null,
						requestedAmount: 4200,
						approvalStatus: "APPROVED",
						approvedById: users[0]?.id ?? null,
						approvalDate: addMonths(-5),
						approvedAmount: 4200,
						paymentStatus: "PAID",
						paymentDate: addMonths(-5),
						paidAmount: 4200,
						paymentMethod: "BANK_TRANSFER",
						paymentReference: "HIST-000117",
						notes: "Captured from the historical payment import.",
					},
				});
				paymentCount++;
				await db.administrativeHistoricalPayment.create({
					data: { paymentId: historical.id, origin: "HISTORICAL_IMPORT", approvalRequired: false },
				});
			}
		}
	}

	// --- Automation runs ---------------------------------------------------
	// The executive briefing reads these directly; without them its evidence table
	// is empty even when every other screen has data.
	for (let d = 1; d <= 10; d++) {
		const scheduledFor = addDays(-d);
		const failed = d === 4;
		await db.$executeRaw(Prisma.sql`
			INSERT INTO "AdministrativeAutomationRun" (
				"id","runKey","jobType","status","scheduledFor","workItemsCreated","escalationsChanged",
				"remindersCreated","digestRecipients","digestSent","digestFailed","failureCode","startedAt","completedAt"
			) VALUES (
				${`run_seed_daily_${pad(d, 2)}`}, ${`DAILY:${scheduledFor.toISOString().slice(0, 10)}`},
				${"DAILY"}, ${failed ? "PARTIAL" : "COMPLETED"}, ${scheduledFor},
				${int(0, 6)}, ${int(0, 4)}, ${int(0, 9)},
				${users.length}, ${failed ? users.length - 1 : users.length}, ${failed ? 1 : 0},
				${failed ? "PROVIDER_TIMEOUT" : null}, ${scheduledFor}, ${scheduledFor}
			)
		`);
	}
	for (let w = 1; w <= 3; w++) {
		const scheduledFor = addDays(-7 * w);
		await db.$executeRaw(Prisma.sql`
			INSERT INTO "AdministrativeAutomationRun" (
				"id","runKey","jobType","status","scheduledFor","workItemsCreated","escalationsChanged",
				"remindersCreated","digestRecipients","digestSent","digestFailed","startedAt","completedAt"
			) VALUES (
				${`run_seed_weekly_${pad(w, 2)}`}, ${`WEEKLY:${scheduledFor.toISOString().slice(0, 10)}`},
				${"WEEKLY"}, ${"COMPLETED"}, ${scheduledFor},
				${int(2, 12)}, ${int(1, 8)}, ${int(3, 18)},
				${users.length}, ${users.length}, ${0}, ${scheduledFor}, ${scheduledFor}
			)
		`);
	}

	console.log(
		[
			"Seeded Corporate Administration:",
			`  ${counterparties.length} counterparties, ${sites.length} sites`,
			`  ${OBLIGATION_COUNT} obligations, ${lineCount} lines`,
			`  ${dueItemCount} due items, ${paymentCount} payments`,
			`  ${workItemCount} work items, ${closureCount} closures, 13 automation runs`,
			`  extra users: ${EXTRA_USERS.map((u) => u.email).join(", ")} (password: ${seedPassword})`,
		].join("\n"),
	);
}
