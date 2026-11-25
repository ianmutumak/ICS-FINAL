// Fills a running Zamu-Check system with synthetic handovers, so that the screens, the audit trail and the statistics
// have something to show. It uses the real programming interface, so every rule is applied exactly as for real users:
// a handover is written, signed by the outgoing person, acknowledged and signed by a different incoming person, and approved.
//
//   DEMO_ADMIN_BADGE=ADMIN-0001 DEMO_ADMIN_PIN=2468 npm run demo:seed -- --cycles 6
//
// Settings (environment):  DEMO_BASE_URL (default http://localhost:3004), DEMO_ADMIN_BADGE, DEMO_ADMIN_PIN
// Options:  --cycles N      number of finished handovers to create (default 6, at most 30)
//           --leave open|pending   open: leave an empty open shift (default); pending: leave one waiting for approval
//           --allow-remote  required to run against anything that is not a local address
//
// All text is invented. No Kenya Airways record, name or number is used. Demo accounts have badge IDs DEMO-01 to DEMO-04.

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const BASE = (process.env.DEMO_BASE_URL || 'http://localhost:3004').replace(/\/$/, '');
const ADMIN_BADGE = process.env.DEMO_ADMIN_BADGE;
const ADMIN_PIN = process.env.DEMO_ADMIN_PIN;
const CYCLES = Math.min(30, Math.max(1, Number(option('--cycles', '6')) || 6));
const LEAVE = option('--leave', 'open');

const host = new URL(BASE).hostname;
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(host);
if (!isLocal && !args.includes('--allow-remote')) {
  console.error(`Refusing to add demo data to ${BASE}. It is not a local address. Add --allow-remote only if you mean it.`);
  process.exit(1);
}
if (!ADMIN_BADGE || !ADMIN_PIN) {
  console.error('Set DEMO_ADMIN_BADGE and DEMO_ADMIN_PIN (an administrator of the system you are filling).');
  process.exit(1);
}
if (!['open', 'pending'].includes(LEAVE)) {
  console.error('--leave must be open or pending');
  process.exit(1);
}
const ORIGIN = isLocal ? 'http://localhost:3001' : new URL(BASE).origin;

// ---------------------------------------------------------------------------------------------- invented content
const DEMO_STAFF = [
  { name: 'Amina Wekesa', staffNumber: 'DEMO-01', pin: '1357', role: 'Cargo Handler', department: 'Import Warehouse', qualification: 'Dangerous Goods' },
  { name: 'Brian Otieno', staffNumber: 'DEMO-02', pin: '2468', role: 'Shift Supervisor', department: 'Export Warehouse', qualification: 'Load Control' },
  { name: 'Caroline Mutiso', staffNumber: 'DEMO-03', pin: '3579', role: 'Cargo Handler', department: 'Cold Chain', qualification: 'Perishables' },
  { name: 'David Kariuki', staffNumber: 'DEMO-04', pin: '4680', role: 'Equipment Operator', department: 'Ramp', qualification: 'Forklift' },
];
const AREAS = ['Import Warehouse', 'Export Warehouse', 'Cold Chain', 'Ramp'];
const SHIFTS = ['morning', 'evening', 'night'];
const UPDATES = [
  ['ULD AKE 4821', 'Pallet awaiting customs release in bay 4.', 'Held since early morning for a document query from the agent.', 'Documents expected before midday.', 'Release to the forwarder once the stamp is received.'],
  ['Cold room 2', 'Temperature steady at 4 degrees.', 'Door seal was replaced yesterday.', 'No further fault seen.', 'Check the log at the start of each hour.'],
  ['Dock door 3', 'Door sensor fails and then works again.', 'A maintenance ticket was raised last week.', 'The door can be used with a spotter.', 'Keep a spotter at the door until it is repaired.'],
  ['Export build-up, flight 214', 'Two pallets are still to be weighed.', 'The scale was calibrated this morning.', 'Weighing should finish within the hour.', 'Close the load list only after both weights are entered.'],
  ['Damaged carton, AWB 000-1234', 'One carton is crushed at a corner.', 'Found at breakdown of an inbound pallet.', 'Contents appear intact.', 'Photograph it and report it to the claims desk.'],
  ['Forklift FL-003', 'Hydraulic hose is leaking slightly.', 'Reported by the previous operator.', 'Safe for light duty only.', 'Do not lift above two metres until it is repaired.'],
  ['Perishables, flight 306', 'Boxes of flowers waiting for transfer to the ramp.', 'They were received twenty minutes late.', 'There is still time before the cut-off.', 'Move them first and tell the ramp lead.'],
];
const WARNINGS = [
  'Lithium batteries on the pallet. Keep away from heat.',
  'Dry ice in the shipment. Ventilate the area.',
  'Wet floor near dock 2. Use the marked path.',
  'Pallet is over height and unstable. Do not stack.',
];
const EQUIPMENT = [
  ['Forklift 3', 'FL-003', 'functional'],
  ['Pallet jack', 'PJ-011', 'functional'],
  ['Handheld scanner', 'HS-027', 'functional'],
  ['Scale, export hall', 'SC-002', 'inspection_due'],
];

// ---------------------------------------------------------------------------------------------- small API client
async function session(badge, pin) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN }, body: JSON.stringify({ staffNumber: badge, pin }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Sign-in as ${badge} failed (${res.status}): ${body.error ?? 'no message'}`);
  return { cookie: res.headers.get('set-cookie').split(';')[0], user: body.user };
}
async function call(s, method, path, data) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: s.cookie, 'X-Expected-User': s.user.id },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${json?.error ?? text}`);
  return json;
}
const pick = (list, i) => list[i % list.length];

// ---------------------------------------------------------------------------------------------- main
const health = await fetch(`${BASE}/healthz`).then((r) => r.json()).catch(() => null);
if (!health || health.status !== 'ok') throw new Error(`The system at ${BASE} did not answer its health check.`);

const admin = await session(ADMIN_BADGE, ADMIN_PIN);
if (!admin.user.isAdmin) throw new Error('That account is not an administrator.');

for (const person of DEMO_STAFF) {
  try { await call(admin, 'POST', '/users', person); console.log(`created ${person.staffNumber}  ${person.name}`); }
  catch (e) { if (/already/i.test(e.message)) console.log(`exists  ${person.staffNumber}`); else throw e; }
}
const staff = await Promise.all(DEMO_STAFF.map((p) => session(p.staffNumber, p.pin)));

let made = 0;
for (let i = 0; i < CYCLES; i++) {
  const lastAndPending = i === CYCLES - 1 && LEAVE === 'pending';
  const outgoing = staff[i % staff.length];
  const incoming = staff[(i + 1) % staff.length];
  let shift = await call(outgoing, 'GET', '/shifts/active');
  if (!shift || !shift.id) shift = await call(outgoing, 'POST', '/shifts', { shiftType: pick(SHIFTS, i), workArea: pick(AREAS, i) });
  // A new shift may already hold items carried over from the last one; only a shift that is already signed is in the way.
  if (shift.signoff?.outgoingConfirmed) {
    console.log(`A shift (${shift.handoverCode}) is already signed and waiting. Approve or cancel it first.`);
    process.exit(1);
  }
  const id = shift.id;

  const howMany = 2 + (i % 2);
  for (let k = 0; k < howMany; k++) {
    const [subjectRef, situation, background, assessment, recommendation] = pick(UPDATES, i * 2 + k);
    const body = { subjectRef, situation, background, assessment, recommendation };
    if (k === 0 && i % 3 !== 2) body.isolationOrHazardAlert = pick(WARNINGS, i);
    await call(outgoing, 'POST', `/shifts/${id}/cases`, body);
  }
  const [name, assetTag, status] = pick(EQUIPMENT, i);
  await call(outgoing, 'POST', `/shifts/${id}/equipment`, { name, assetTag, status });
  await call(outgoing, 'POST', `/shifts/${id}/sign/outgoing`, {});

  const current = await call(incoming, 'GET', '/shifts/active');
  for (const update of current.cases.filter((c) => c.isolationOrHazardAlert)) {
    await call(incoming, 'POST', `/shifts/${id}/cases/${update.id}/acknowledge`, {});
  }
  await call(incoming, 'POST', `/shifts/${id}/sign/incoming`, {});
  if (!lastAndPending) await call(admin, 'POST', `/shifts/${id}/approve`, {});
  made++;
  console.log(`handover ${made}/${CYCLES}  ${current.handoverCode}  ${outgoing.user.name} -> ${incoming.user.name}${lastAndPending ? '  (waiting for approval)' : '  (approved)'}`);
}
console.log(`Done. ${made} synthetic handovers added to ${BASE}. Demo accounts: ${DEMO_STAFF.map((p) => p.staffNumber).join(', ')} (PINs are in this script).`);
