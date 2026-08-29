require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../src/config/db');

async function seed() {
  console.log('Seeding SmartYatra demo data...');

  // Run schema first
  const fs = require('fs'), path = require('path');
  const sql = fs.readFileSync(path.join(__dirname, '001_schema_sqlite.sql'), 'utf8');
  db.exec(sql);

  const passwordHash = await bcrypt.hash('demo1234', 10);

  const adminId    = uuidv4();
  const driverId1  = uuidv4();
  const driverId2  = uuidv4();
  const driverId3  = uuidv4();
  const farmerId1  = uuidv4();
  const farmerId2  = uuidv4();
  const passId1    = uuidv4();
  const passId2    = uuidv4();

  const seedAll = db.transaction(() => {
    // Users
    const insertUser = db.prepare(
      `INSERT OR IGNORE INTO users (id, name, mobile, email, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    [
      [adminId,   'Admin User',       '9000000001', 'admin@smartyatra.in',      passwordHash, 'ADMIN'],
      [driverId1, 'Ramesh Patil',     '9000000002', 'driver1@smartyatra.in',    passwordHash, 'DRIVER'],
      [driverId2, 'Suresh More',      '9000000003', 'driver2@smartyatra.in',    passwordHash, 'DRIVER'],
      [driverId3, 'Ganesh Shinde',    '9000000004', 'driver3@smartyatra.in',    passwordHash, 'DRIVER'],
      [farmerId1, 'Manoj Jadhav',     '9000000005', 'farmer1@smartyatra.in',    passwordHash, 'FARMER'],
      [farmerId2, 'Sunita Bhoite',    '9000000006', 'farmer2@smartyatra.in',    passwordHash, 'FARMER'],
      [passId1,   'Priya Kulkarni',   '9000000007', 'pass1@smartyatra.in',      passwordHash, 'PASSENGER'],
      [passId2,   'Amit Deshmukh',    '9000000008', 'pass2@smartyatra.in',      passwordHash, 'PASSENGER'],
    ].forEach(u => insertUser.run(...u));
    console.log('✅ Users seeded');

    // Routes
    const routeId1 = uuidv4(), routeId2 = uuidv4(), routeId3 = uuidv4();
    const insertRoute = db.prepare(
      `INSERT OR IGNORE INTO routes (id, name, origin, destination, distance_km, estimated_duration_min)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    [
      [routeId1, 'Kopargaon - Nashik', 'Kopargaon', 'Nashik', 95,  150],
      [routeId2, 'Kopargaon - Shirdi', 'Kopargaon', 'Shirdi', 35,   60],
      [routeId3, 'Kopargaon - Manmad', 'Kopargaon', 'Manmad', 45,   75],
    ].forEach(r => insertRoute.run(...r));
    console.log('✅ Routes seeded');

    // Stops
    const insertStop = db.prepare(
      `INSERT OR IGNORE INTO stops (id, route_id, name, latitude, longitude, sequence)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const stopsData = [
      [routeId1, 'Kopargaon Bus Stand', 19.7157, 74.4704, 1],
      [routeId1, 'Rahata',              19.7200, 74.4900, 2],
      [routeId1, 'Sinnar',              19.8473, 74.0022, 3],
      [routeId1, 'Nashik CBS',          19.9975, 73.7898, 4],
      [routeId2, 'Kopargaon Bus Stand', 19.7157, 74.4704, 1],
      [routeId2, 'Srirampur',           19.6118, 74.6563, 2],
      [routeId2, 'Shirdi Bus Stand',    19.7653, 74.4778, 3],
      [routeId3, 'Kopargaon Bus Stand', 19.7157, 74.4704, 1],
      [routeId3, 'Yeola',               20.0449, 74.4886, 2],
      [routeId3, 'Manmad',              20.2548, 74.4400, 3],
    ];
    stopsData.forEach(s => insertStop.run(uuidv4(), s[0], s[1], s[2], s[3], s[4]));
    console.log('✅ Stops seeded');

    // Buses
    const insertBus = db.prepare(
      `INSERT OR IGNORE INTO buses
         (id, bus_number, route_id, driver_id, seat_capacity, current_occupancy,
          cargo_capacity_kg, booked_cargo_kg, loaded_cargo_kg, status,
          current_latitude, current_longitude, gps_status, departure_time, arrival_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const busId1 = uuidv4(), busId2 = uuidv4(), busId3 = uuidv4();
    [
      [busId1, 'BUS-001', routeId1, driverId1, 50, 0, 500, 0, 0, 'SCHEDULED', 19.7157, 74.4704, 'OFFLINE', '08:00', '10:30'],
      [busId2, 'BUS-002', routeId2, driverId2, 50, 0, 400, 0, 0, 'SCHEDULED', 19.7157, 74.4704, 'OFFLINE', '10:00', '11:00'],
      [busId3, 'BUS-003', routeId3, driverId3, 50, 0, 450, 0, 0, 'SCHEDULED', 19.7157, 74.4704, 'OFFLINE', '12:00', '13:15'],
    ].forEach(b => insertBus.run(...b));
    console.log('✅ Buses seeded');
  });

  seedAll();

  console.log('');
  console.log('🎉 Seed complete! Demo credentials (password: demo1234):');
  console.log('   Admin:       9000000001');
  console.log('   Driver 1:    9000000002  (BUS-001, Kopargaon→Nashik)');
  console.log('   Driver 2:    9000000003  (BUS-002, Kopargaon→Shirdi)');
  console.log('   Driver 3:    9000000004  (BUS-003, Kopargaon→Manmad)');
  console.log('   Farmer 1:    9000000005');
  console.log('   Farmer 2:    9000000006');
  console.log('   Passenger 1: 9000000007');
  console.log('   Passenger 2: 9000000008');
}

seed().catch(err => { console.error(err); process.exit(1); });
