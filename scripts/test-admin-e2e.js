/**
 * Admin E2E test – kør med: node scripts/test-admin-e2e.js
 */

const fs = require('fs');
const path = require('path');

const BASE = process.env.TEST_BASE || 'http://localhost:8765';
const PASSWORD = process.env.ADMIN_PASSWORD || 'xtreme2026';

let cookie = '';

async function req(method, urlPath, body) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.headers.get('set-cookie')) {
    cookie = res.headers.get('set-cookie').split(';')[0];
  }

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  return { status: res.status, data };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function run() {
  console.log(`Testing admin against ${BASE}\n`);

  let r = await req('GET', '/api/admin/me');
  assert(r.status === 200 && r.data.loggedIn === false, 'me should be logged out');

  r = await req('POST', '/api/admin/login', { password: PASSWORD });
  assert(r.status === 200 && r.data.ok, 'login failed');
  console.log('✓ Login');

  r = await req('GET', '/api/admin/products');
  assert(r.status === 200 && Array.isArray(r.data), 'products list failed');
  console.log(`✓ List products (${r.data.length})`);

  r = await req('POST', '/api/admin/products/draft', {
    title: 'E2E Test Bike',
    cc: '1745',
    gears: '6',
    km: '30141',
    specs: ['ABS', 'SYNET'],
    price: '199900',
  });
  assert(r.status === 200 && r.data.id, 'draft create failed');
  const id = r.data.id;
  console.log(`✓ Create draft #${id}`);

  const logo = fs.readFileSync(path.join(__dirname, '../assets/images/logo.png'));
  const b64 = logo.toString('base64');

  r = await req('POST', `/api/admin/products/${id}/images`, {
    images: [{ name: 'test1.jpg', data: b64 }],
  });
  assert(r.status === 200 && r.data.urls?.length, 'image upload failed');
  console.log(`✓ Upload image (${r.data.urls[0]})`);

  r = await req('PUT', `/api/admin/products/${id}`, {
    title: 'E2E Test Bike',
    cc: '1745',
    gears: '6',
    km: '30141',
    specs: ['ABS', 'SYNET'],
    price: '199900',
    images: r.data.product.images,
    image: r.data.product.image,
  });
  assert(r.status === 200 && r.data.status === 'available', 'save/publish failed');
  console.log('✓ Publish product');

  r = await req('GET', `/api/products/${id}`);
  assert(r.status === 200 && r.data.title === 'E2E Test Bike', 'public API failed');
  console.log('✓ Public API shows product');

  const imgUrl = r.data.image;
  const imgRes = await fetch(imgUrl.startsWith('http') ? imgUrl : `${BASE}${imgUrl}`);
  assert(imgRes.status === 200, 'image serve failed');
  const imgBuf = Buffer.from(await imgRes.arrayBuffer());
  assert(imgBuf[0] === 0xff && imgBuf[1] === 0xd8, 'image is not valid JPEG');
  console.log('✓ Image accessible and valid JPEG');

  r = await req('DELETE', `/api/admin/products/${id}`);
  assert(r.status === 200, 'delete failed');
  console.log('✓ Delete product');

  r = await req('POST', '/api/admin/logout');
  assert(r.status === 200, 'logout failed');
  console.log('✓ Logout');

  console.log('\nAll tests passed!');
}

run().catch(err => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
