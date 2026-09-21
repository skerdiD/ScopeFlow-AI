import { disconnectPrisma } from "../src/lib/prisma.js";
import { seedDemoWorkspace } from "../src/services/demo.service.js";

const reset = process.argv.includes("--reset");

try {
  const result = await seedDemoWorkspace({ reset });
  console.log(`Demo data seeded for ${result.user.email}: ${result.projects} projects.`);
} finally {
  await disconnectPrisma();
}
