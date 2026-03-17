require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { username: 'admin' }, select: { id: true, passwordHash: true } });
  if (!user) { console.log('No admin user found!'); return; }
  console.log('DB hash (first 30 chars):', user.passwordHash.substring(0, 30) + '...');

  // Test against the seed password
  const envPass = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  console.log('ENV password:', envPass);
  const matchEnv = await bcrypt.compare(envPass || '', user.passwordHash);
  console.log('Matches ENV password?', matchEnv);

  // Test against the test script's OLD_PASS
  const oldPass = 'SuperStrongP@ssw0rd!123@@';
  const matchOld = await bcrypt.compare(oldPass, user.passwordHash);
  console.log('Matches "SuperStrongP@ssw0rd!123@@"?', matchOld);

  // Test against the NEW test script NEW_PASS (with spaces)
  const newPass = ' Super Strong Pass ! 123 ';
  const matchNew = await bcrypt.compare(newPass, user.passwordHash);
  console.log('Matches " Super Strong Pass ! 123 " (with spaces)?', matchNew);

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
