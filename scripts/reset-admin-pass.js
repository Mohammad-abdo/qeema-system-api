require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const TARGET_PASS = 'SuperStrongP@ssw0rd!123@@';

bcrypt.hash(TARGET_PASS, 10).then(h => {
  return prisma.user.update({ where: { username: 'admin' }, data: { passwordHash: h } });
}).then(() => {
  console.log('Password reset to seed password: ' + TARGET_PASS);
  return prisma.$disconnect();
}).catch(e => { console.error(e); process.exit(1); });
