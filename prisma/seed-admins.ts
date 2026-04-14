import { auth } from "../lib/auth";
import prisma from "../lib/prisma";

const ADMINS = [
  { name: "Lee", email: "lee@fbm.com", password: "FBMInfluencer2026!" },
  { name: "Hanna", email: "hanna@fbm.com", password: "FBMInfluencer2026!" },
  { name: "Test Admin", email: "test-admin@fbm.com", password: "FBMTestAdmin2026!" },
];

async function main() {
  for (const admin of ADMINS) {
    // Check if already exists
    const existing = await prisma.user.findFirst({
      where: { email: admin.email },
    });

    if (existing) {
      console.log(`✓ ${admin.email} already exists (id: ${existing.id}, role: ${existing.role})`);
      // Ensure admin role
      if (existing.role !== "admin") {
        await prisma.user.update({
          where: { id: existing.id },
          data: { role: "admin" },
        });
        console.log(`  → promoted to admin`);
      }
      continue;
    }

    // Create via Better Auth (handles password hashing)
    const res = await auth.api.signUpEmail({
      body: {
        name: admin.name,
        email: admin.email,
        password: admin.password,
      },
    });

    if (!res.user) {
      console.error(`✗ Failed to create ${admin.email}`);
      continue;
    }

    // Promote to admin
    await prisma.user.update({
      where: { id: res.user.id },
      data: { role: "admin" },
    });

    console.log(`✓ Created ${admin.email} as admin (id: ${res.user.id})`);
  }

  console.log("\nDone.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
