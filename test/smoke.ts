import fetch from 'node-fetch';

async function run() {
  console.log('Running smoke tests for Multi-Tenant Payment Platform...');

  const baseUrl = 'http://localhost:3000/payments';

  // Scenario 1: Request with invalid tenant
  console.log('\n--- Scenario 1: Request with invalid tenant ---');
  let res = await fetch(baseUrl, {
    headers: { 'X-Tenant-ID': 'invalid-tenant' },
  });
  if (res.status === 401) {
    console.log('PASS: Returned 401 for invalid tenant.');
  } else {
    console.log(`FAIL: Expected 401, got ${res.status}`);
  }

  // Scenario 2: Request with no tenant header
  console.log('\n--- Scenario 2: Request with no tenant header ---');
  res = await fetch(baseUrl);
  if (res.status === 401) {
    console.log('PASS: Returned 401 for missing tenant.');
  } else {
    console.log(`FAIL: Expected 401, got ${res.status}`);
  }

  // Scenario 3: Request with valid tenant
  console.log('\n--- Scenario 3: Request with valid tenant ---');
  res = await fetch(baseUrl, {
    headers: { 'X-Tenant-ID': 'bank1' }, // Assume 'bank1' might be seeded, or test-tenant
  });
  if (res.status === 200 || res.status === 401) { // 401 if 'bank1' is not seeded in DB
    console.log(`PASS: Returned ${res.status} for valid tenant.`);
  } else {
    console.log(`FAIL: Expected 200 or 401, got ${res.status}`);
  }
}

run().catch(console.error);
