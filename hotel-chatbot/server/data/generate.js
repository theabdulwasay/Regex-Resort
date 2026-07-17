/**
 * generate.js
 * Deterministic seed-data generator for the Hotel Concierge chatbot.
 * Produces hotels.json, rooms.json, faqs.json, bookings.json under server/data/.
 * Run with: npm run seed
 */
const fs = require('fs');
const path = require('path');

// ---- deterministic PRNG so the dataset is reproducible ----
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260716);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const round2 = (n) => Math.round(n * 100) / 100;

const CITIES = [
  { name: 'Lahore', country: 'Pakistan', tier: 2 },
  { name: 'Karachi', country: 'Pakistan', tier: 2 },
  { name: 'Islamabad', country: 'Pakistan', tier: 2 },
  { name: 'Dubai', country: 'UAE', tier: 1 },
  { name: 'Istanbul', country: 'Turkey', tier: 1 },
  { name: 'London', country: 'UK', tier: 1 },
  { name: 'New York', country: 'USA', tier: 1 },
  { name: 'Paris', country: 'France', tier: 1 },
  { name: 'Bangkok', country: 'Thailand', tier: 2 },
  { name: 'Kuala Lumpur', country: 'Malaysia', tier: 2 },
];

const HOTEL_ADJ = ['Grand', 'Royal', 'Imperial', 'Crescent', 'Palm', 'Azure', 'Regal', 'Meridian', 'Orchid', 'Pearl'];
const HOTEL_NOUN = ['Palace', 'Residency', 'Suites', 'Towers', 'Plaza', 'Gardens', 'Heights', 'Inn', 'Resort & Spa', 'Boutique Hotel'];

const ROOM_TYPES = [
  { type: 'Single', base: 45, capacity: 1, weight: 20 },
  { type: 'Double', base: 65, capacity: 2, weight: 25 },
  { type: 'Twin', base: 65, capacity: 2, weight: 15 },
  { type: 'Deluxe', base: 95, capacity: 3, weight: 20 },
  { type: 'Executive Suite', base: 160, capacity: 3, weight: 10 },
  { type: 'Family Suite', base: 140, capacity: 4, weight: 7 },
  { type: 'Presidential Suite', base: 320, capacity: 4, weight: 3 },
];
const weightedRoomType = () => {
  const total = ROOM_TYPES.reduce((s, r) => s + r.weight, 0);
  let r = rand() * total;
  for (const rt of ROOM_TYPES) {
    if (r < rt.weight) return rt;
    r -= rt.weight;
  }
  return ROOM_TYPES[0];
};

const AMENITIES_POOL = [
  'Free WiFi', 'Air Conditioning', 'Flat-screen TV', 'Minibar', 'Balcony',
  'Sea View', 'City View', 'Bathtub', 'Jacuzzi', '24h Room Service',
  'In-room Safe', 'Coffee Maker', 'Work Desk', 'Iron & Board', 'Hairdryer',
  'Soundproofing', 'Rain Shower', 'Bluetooth Speaker', 'Kitchenette', 'Bathrobe & Slippers',
];
const HOTEL_FACILITIES_POOL = [
  'Outdoor Pool', 'Indoor Pool', 'Fitness Center', 'Spa & Wellness Center', 'Airport Shuttle',
  'Business Center', 'Free Parking', 'Rooftop Bar', 'Fine-dining Restaurant', 'Kids Club',
  'Conference Rooms', 'Concierge Desk', 'Laundry Service', 'Pet Friendly', 'EV Charging',
];

function sample(pool, n) {
  const copy = [...pool];
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  }
  return out;
}

// ---------------- HOTELS ----------------
const hotels = [];
let hotelId = 1;
for (const city of CITIES) {
  for (let h = 0; h < 5; h++) {
    const stars = city.tier === 1 ? randInt(3, 5) : randInt(2, 5);
    hotels.push({
      id: hotelId,
      name: `${pick(HOTEL_ADJ)} ${pick(HOTEL_NOUN)} ${city.name}`,
      city: city.name,
      country: city.country,
      stars,
      address: `${randInt(1, 250)} ${pick(['Main Blvd', 'Garden Rd', 'Harbor St', 'Central Ave', 'Park Lane', 'Market Street'])}, ${city.name}`,
      facilities: sample(HOTEL_FACILITIES_POOL, randInt(5, 9)),
      checkInTime: '14:00',
      checkOutTime: '12:00',
      rating: round2(3.2 + rand() * 1.7),
      reviewCount: randInt(80, 4200),
      contact: {
        phone: `+${randInt(1, 99)}-${randInt(200, 999)}-${randInt(1000000, 9999999)}`,
        email: `reservations@${(pick(HOTEL_ADJ) + pick(HOTEL_NOUN)).toLowerCase().replace(/[^a-z]/g, '')}${hotelId}.com`,
      },
    });
    hotelId++;
  }
}

// ---------------- ROOMS ----------------
const rooms = [];
let roomId = 1;
for (const hotel of hotels) {
  const cityTier = CITIES.find((c) => c.name === hotel.city).tier;
  const roomsInHotel = 200; // 50 hotels * 200 rooms = 10,000 rooms
  for (let r = 0; r < roomsInHotel; r++) {
    const rt = weightedRoomType();
    const floor = Math.floor(r / 20) + 1; // 20 rooms per floor
    const roomOnFloor = (r % 20) + 1;
    const tierMultiplier = cityTier === 1 ? 1.35 : 1.0;
    const starMultiplier = 0.8 + hotel.stars * 0.12;
    const price = round2(rt.base * tierMultiplier * starMultiplier * (0.9 + rand() * 0.3));
    const amenities = sample(AMENITIES_POOL, randInt(4, 8));
    rooms.push({
      id: roomId,
      hotelId: hotel.id,
      hotelName: hotel.name,
      city: hotel.city,
      roomNumber: `${floor}${String(roomOnFloor).padStart(2, '0')}`,
      floor,
      type: rt.type,
      capacity: rt.capacity,
      pricePerNight: price,
      currency: 'USD',
      available: rand() > 0.35, // ~65% available
      smoking: rand() > 0.9,
      amenities,
    });
    roomId++;
  }
}

// ---------------- FAQS (rule-based knowledge base) ----------------
const faqs = [
  { id: 1, category: 'check-in', keywords: ['check in', 'checkin', 'check-in time', 'arrival time'], question: 'What time is check-in?', answer: 'Standard check-in time is 2:00 PM (14:00). Early check-in may be available on request, subject to room availability.' },
  { id: 2, category: 'check-out', keywords: ['check out', 'checkout', 'check-out time', 'departure time'], question: 'What time is check-out?', answer: 'Standard check-out time is 12:00 PM (noon). Late check-out can be arranged for an additional fee, subject to availability.' },
  { id: 3, category: 'cancellation', keywords: ['cancel', 'cancellation', 'refund policy'], question: 'What is the cancellation policy?', answer: 'Free cancellation is available up to 48 hours before check-in. Cancellations within 48 hours are subject to a one-night charge.' },
  { id: 4, category: 'payment', keywords: ['payment', 'pay', 'credit card', 'cash', 'currency'], question: 'What payment methods are accepted?', answer: 'We accept all major credit/debit cards, bank transfers, and cash payments in local currency at the front desk.' },
  { id: 5, category: 'pets', keywords: ['pet', 'dog', 'cat', 'animal'], question: 'Are pets allowed?', answer: 'Pet-friendly rooms are available at select properties for an additional cleaning fee. Please mention your pet when booking.' },
  { id: 6, category: 'parking', keywords: ['parking', 'car park', 'valet'], question: 'Is parking available?', answer: 'Most of our hotels offer free self-parking, and valet parking is available at premium properties for an extra charge.' },
  { id: 7, category: 'wifi', keywords: ['wifi', 'wi-fi', 'internet'], question: 'Is WiFi available?', answer: 'Complimentary high-speed WiFi is available throughout all our properties, in-room and in public areas.' },
  { id: 8, category: 'breakfast', keywords: ['breakfast', 'meal', 'buffet'], question: 'Is breakfast included?', answer: 'Breakfast is included with most room rates; a full buffet breakfast is served daily between 7:00 AM and 10:30 AM.' },
  { id: 9, category: 'pool', keywords: ['pool', 'swimming'], question: 'Do you have a swimming pool?', answer: 'Many of our hotels feature outdoor or indoor pools — check the specific hotel facilities for details.' },
  { id: 10, category: 'gym', keywords: ['gym', 'fitness', 'workout'], question: 'Is there a fitness center?', answer: 'Most properties include a 24-hour fitness center equipped with modern cardio and strength equipment.' },
  { id: 11, category: 'children', keywords: ['kids', 'children', 'child', 'family'], question: 'Is the hotel family friendly?', answer: 'Yes, our hotels welcome families and many properties offer kids clubs, cribs, and family suites on request.' },
  { id: 12, category: 'smoking', keywords: ['smoking', 'smoke'], question: 'Do you have smoking rooms?', answer: 'A limited number of designated smoking rooms are available on request; most rooms and public areas are strictly non-smoking.' },
  { id: 13, category: 'shuttle', keywords: ['airport', 'shuttle', 'transfer'], question: 'Is airport transfer available?', answer: 'Airport shuttle service is available at select hotels — please share your flight details in advance to arrange pickup.' },
  { id: 14, category: 'spa', keywords: ['spa', 'massage', 'wellness'], question: 'Do you offer spa services?', answer: 'Select properties feature a full-service spa and wellness center offering massages, facials, and sauna access.' },
  { id: 15, category: 'accessibility', keywords: ['wheelchair', 'accessible', 'disability'], question: 'Are rooms wheelchair accessible?', answer: 'Accessible rooms with wider doorways and roll-in showers are available on request — please specify when booking.' },
  { id: 16, category: 'extra-bed', keywords: ['extra bed', 'crib', 'cot', 'baby bed'], question: 'Can I request an extra bed or crib?', answer: 'Extra beds and cribs can be added to most rooms for a small nightly fee — subject to room size and availability.' },
  { id: 17, category: 'contact', keywords: ['contact', 'phone number', 'email', 'reach you'], question: 'How can I contact the hotel?', answer: 'You can reach the front desk 24/7 via the phone number and email listed on your booking confirmation.' },
];

// ---------------- BOOKINGS (sample historical/future bookings) ----------------
const GUEST_FIRST = ['Ahmed', 'Sara', 'John', 'Emily', 'Ali', 'Fatima', 'Michael', 'Linda', 'Omar', 'Ayesha', 'David', 'Maria', 'Hassan', 'Zainab', 'Chris', 'Nadia'];
const GUEST_LAST = ['Khan', 'Smith', 'Malik', 'Johnson', 'Raza', 'Brown', 'Ahmed', 'Wilson', 'Iqbal', 'Taylor', 'Baig', 'Anderson'];
const STATUSES = ['confirmed', 'checked-in', 'checked-out', 'cancelled'];

function randomDate(startDaysOffset, spanDays) {
  const d = new Date();
  d.setDate(d.getDate() + startDaysOffset + randInt(0, spanDays));
  return d.toISOString().slice(0, 10);
}

const bookings = [];
for (let i = 1; i <= 600; i++) {
  const room = rooms[randInt(0, rooms.length - 1)];
  const checkIn = randomDate(-30, 60);
  const nights = randInt(1, 7);
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkInDate);
  checkOutDate.setDate(checkInDate.getDate() + nights);
  bookings.push({
    id: i,
    bookingRef: `HTL-${String(100000 + i)}`,
    guestName: `${pick(GUEST_FIRST)} ${pick(GUEST_LAST)}`,
    hotelId: room.hotelId,
    hotelName: room.hotelName,
    roomId: room.id,
    roomType: room.type,
    checkIn,
    checkOut: checkOutDate.toISOString().slice(0, 10),
    nights,
    totalPrice: round2(room.pricePerNight * nights),
    status: pick(STATUSES),
    guests: randInt(1, room.capacity),
  });
}

// ---------------- WRITE OUT ----------------
const outDir = __dirname;
fs.writeFileSync(path.join(outDir, 'hotels.json'), JSON.stringify(hotels, null, 2));
fs.writeFileSync(path.join(outDir, 'rooms.json'), JSON.stringify(rooms, null, 2));
fs.writeFileSync(path.join(outDir, 'faqs.json'), JSON.stringify(faqs, null, 2));
fs.writeFileSync(path.join(outDir, 'bookings.json'), JSON.stringify(bookings, null, 2));

const total = hotels.length + rooms.length + faqs.length + bookings.length;
console.log('Seed data generated:');
console.log(`  hotels:   ${hotels.length}`);
console.log(`  rooms:    ${rooms.length}`);
console.log(`  faqs:     ${faqs.length}`);
console.log(`  bookings: ${bookings.length}`);
console.log(`  TOTAL RECORDS: ${total}`);
