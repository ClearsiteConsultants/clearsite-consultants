import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

const cs = (process.env.POSTGRES_URL || process.env.DATABASE_URL || '').replace(/\\\$/g, '$');
const sql = postgres(cs, { ssl: false });

const [conn] = await sql`SELECT access_token, realm_id FROM quickbooks_connections LIMIT 1`;
if (!conn) {
  console.log('No QBO connection found — connect first at /admin/invoices');
  await sql.end();
  process.exit(1);
}

const base = process.env.QUICKBOOKS_ENVIRONMENT === 'sandbox'
  ? 'https://sandbox-quickbooks.api.intuit.com'
  : 'https://quickbooks.api.intuit.com';

const res = await fetch(
  `${base}/v3/company/${conn.realm_id}/query?query=SELECT Id,Name FROM Item WHERE Active=true&minorversion=65`,
  { headers: { Authorization: `Bearer ${conn.access_token}`, Accept: 'application/json' } }
);
const data = await res.json();
const items = data?.QueryResponse?.Item || [];
if (items.length === 0) {
  console.log('No items found (token may be expired — restart dev server and reconnect)');
} else {
  console.log('QuickBooks Items:');
  items.forEach(i => console.log(`  Id: ${i.Id.padEnd(6)} Name: ${i.Name}`));
}
await sql.end();
