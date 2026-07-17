/**
 * db.js — lightweight in-memory "database" layer.
 * Loads the generated JSON dataset once at startup and exposes
 * simple, indexed query helpers used by the rule engine & routes.
 *
 * Swap-out note: because all reads/writes go through this module,
 * it can be replaced with a real DB (Postgres/Mongo) later without
 * touching the NLP engine or route handlers.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

function loadJSON(file) {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) {
    throw new Error(`Dataset missing: ${file}. Run "npm run seed" first.`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

const hotels = loadJSON('hotels.json');
const rooms = loadJSON('rooms.json');
const faqs = loadJSON('faqs.json');
let bookings = loadJSON('bookings.json');

// ---- indexes for fast lookup ----
const hotelsById = new Map(hotels.map((h) => [h.id, h]));
const roomsByHotel = new Map();
for (const r of rooms) {
  if (!roomsByHotel.has(r.hotelId)) roomsByHotel.set(r.hotelId, []);
  roomsByHotel.get(r.hotelId).push(r);
}
const citiesIndex = [...new Set(hotels.map((h) => h.city))];

let nextBookingId = bookings.length ? Math.max(...bookings.map((b) => b.id)) + 1 : 1;

module.exports = {
  hotels,
  rooms,
  faqs,
  getBookings: () => bookings,
  cities: citiesIndex,

  getHotelById: (id) => hotelsById.get(Number(id)),

  findHotelsByCity(city) {
    if (!city) return [];
    const q = city.toLowerCase();
    return hotels.filter((h) => h.city.toLowerCase().includes(q));
  },

  findCityMention(text) {
    const lower = text.toLowerCase();
    return citiesIndex.find((c) => lower.includes(c.toLowerCase()));
  },

  searchRooms({ city, type, maxPrice, minPrice, guests, availableOnly = true } = {}) {
    let list = rooms;
    if (city) {
      const q = city.toLowerCase();
      list = list.filter((r) => r.city.toLowerCase().includes(q));
    }
    if (type) {
      const q = type.toLowerCase();
      list = list.filter((r) => r.type.toLowerCase().includes(q));
    }
    if (typeof maxPrice === 'number') list = list.filter((r) => r.pricePerNight <= maxPrice);
    if (typeof minPrice === 'number') list = list.filter((r) => r.pricePerNight >= minPrice);
    if (typeof guests === 'number') list = list.filter((r) => r.capacity >= guests);
    if (availableOnly) list = list.filter((r) => r.available);
    return list;
  },

  createBooking({ guestName, roomId, checkIn, checkOut, guests }) {
    const room = rooms.find((r) => r.id === Number(roomId));
    if (!room) throw new Error('Room not found');
    if (!room.available) throw new Error('Room not available');

    const nights = Math.max(1, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000) || 1);
    const booking = {
      id: nextBookingId++,
      bookingRef: `HTL-${String(100000 + nextBookingId)}`,
      guestName,
      hotelId: room.hotelId,
      hotelName: room.hotelName,
      roomId: room.id,
      roomType: room.type,
      checkIn,
      checkOut,
      nights,
      totalPrice: Math.round(room.pricePerNight * nights * 100) / 100,
      status: 'confirmed',
      guests: guests || 1,
    };
    bookings.push(booking);
    room.available = false;
    return booking;
  },

  findBookingByRef(ref) {
    return bookings.find((b) => b.bookingRef.toLowerCase() === String(ref).toLowerCase());
  },

  cancelBooking(ref) {
    const booking = this.findBookingByRef(ref);
    if (!booking) return null;
    booking.status = 'cancelled';
    const room = rooms.find((r) => r.id === booking.roomId);
    if (room) room.available = true;
    return booking;
  },

  stats() {
    return {
      hotels: hotels.length,
      rooms: rooms.length,
      availableRooms: rooms.filter((r) => r.available).length,
      faqs: faqs.length,
      bookings: bookings.length,
      cities: citiesIndex.length,
    };
  },
};
