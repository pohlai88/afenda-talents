import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import instrument from "../data/instrument.json";

// The seed runs standalone via tsx, so it builds its own client rather than importing
// src/lib/db.ts (which pulls in the full env validation this script does not need).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
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
