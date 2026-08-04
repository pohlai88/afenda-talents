import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import instrument from "../data/instrument.json";

// The seed runs standalone via tsx, so it builds its own client rather than importing
// src/lib/db.ts (which pulls in the full env validation this script does not need).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  // Bootstrap hiring user: the env credentials become the first ADMIN account.
  // Further users are created from the dashboard by an admin. Idempotent: the
  // password is only (re)set when the account is first created.
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const { hashPassword } = await import("../src/lib/passwords");
    await db.user.upsert({
      where: { email: adminEmail },
      update: { role: "ADMIN" },
      create: {
        email: adminEmail,
        name: "Administrator",
        passwordHash: hashPassword(adminPassword),
        role: "ADMIN",
      },
    });
    console.log(`Admin user ensured: ${adminEmail}`);
  }

  // Upsert keyed on the stable item id is what makes re-running safe.
  for (const item of instrument.items) {
    await db.item.upsert({
      where: { id: item.id },
      update: {
        dimension: item.dimension,
        order: item.order,
        text: item.text,
        reverseScored: item.reverseScored,
        isValidity: item.isValidity,
      },
      create: item,
    });
  }
  const count = await db.item.count();
  console.log(`Seeded instrument. Item count: ${count}`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
