const { db } = require('../server/db.ts');
const { permissions } = require('../shared/schema.ts');

const PERMISSIONS = [
  'cards:view',
  'cards:create',
  'cards:edit',
  'cards:delete',
];

async function seedPermissions() {
  console.log('Seeding permissions...');
  
  for (const key of PERMISSIONS) {
    try {
      await db.insert(permissions).values({ key }).onConflictDoNothing();
      console.log(`✓ Permission registered: ${key}`);
    } catch (e) {
      console.warn(`⚠️ Could not insert permission ${key}:`, e.message);
    }
  }
  
  console.log('✓ Permissions seeded successfully');
  process.exit(0);
}

seedPermissions().catch((error) => {
  console.error('Failed to seed permissions:', error);
  process.exit(1);
});
