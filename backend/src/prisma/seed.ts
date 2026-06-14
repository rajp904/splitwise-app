// Database seed script.
// Creates the USD→INR exchange rate needed for the CSV import.
// Run with: npm run db:seed

import prisma from '../config/prisma';

async function main() {
  console.log('Seeding database...');

  // Seed USD → INR rate for the Goa trip (March 2026)
  // This rate must exist before importing the CSV
  await prisma.exchangeRate.upsert({
    where: { id: 'seed-usd-inr-2026' },
    create: {
      id: 'seed-usd-inr-2026',
      fromCurrency: 'USD',
      toCurrency: 'INR',
      rate: 84.5,  // approximate rate for March 2026
      effectiveDate: new Date('2026-01-01'),
      source: 'manual',
    },
    update: {},
  });

  console.log('Seeded exchange rate: 1 USD = 84.5 INR (effective 2026-01-01)');
  console.log('Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
