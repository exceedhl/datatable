import { faker } from '@faker-js/faker';
import { initDb, getDb } from './db.js';
import { v4 as uuidv4 } from 'uuid';

export async function seedDb(rowCount = 5000) {
  const db = await initDb();

  const countRes = await db.get('SELECT COUNT(*) as count FROM records');
  if (countRes.count > 0) {
    console.log(`DB already seeded with ${countRes.count} records.`);
    return;
  }

  console.log(`Seeding DB with ${rowCount} records...`);

  const statuses = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
  const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const departments = ['工程', '产品', '设计', '运营', '市场'];
  const tags = ['P0', 'P1', 'P2', 'Bug', '需求', '优化', '技术债'];

  const stmt = await db.prepare(
    'INSERT INTO records (row_id, data) VALUES (?, ?)'
  );

  for (let i = 0; i < rowCount; i++) {
    const createdAt = faker.date.between({ from: '2025-01-01', to: '2026-03-24' });
    const recordData = {
      owner: faker.person.fullName(),
      status: faker.helpers.arrayElement(statuses),
      title: faker.lorem.words({ min: 3, max: 7 }),
      priority: faker.helpers.arrayElement(priorities),
      progress: faker.number.int({ min: 0, max: 100 }),
      department: faker.helpers.arrayElement(departments),
      estimate: faker.number.int({ min: 1, max: 40 }),
      tag: faker.helpers.arrayElement(tags),
      createdAt: createdAt.toISOString().slice(0, 10),
    };
    await stmt.run(uuidv4(), JSON.stringify(recordData));
  }

  await stmt.finalize();
  console.log('Seeding completed!');
}

// Allow direct execution
const isMain = process.argv[1] && process.argv[1].endsWith('seed.js');
if (isMain) {
  seedDb().catch(console.error);
}
