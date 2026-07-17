const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/hotels?city=Dubai
router.get('/hotels', (req, res) => {
  const { city } = req.query;
  const list = city ? db.findHotelsByCity(city) : db.hotels;
  res.json({ count: list.length, hotels: list });
});

// GET /api/hotels/:id
router.get('/hotels/:id', (req, res) => {
  const hotel = db.getHotelById(req.params.id);
  if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
  res.json({ hotel });
});

// GET /api/rooms/search?city=&type=&maxPrice=&minPrice=&guests=
router.get('/rooms/search', (req, res) => {
  const { city, type, maxPrice, minPrice, guests } = req.query;
  const rooms = db.searchRooms({
    city,
    type,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    guests: guests ? Number(guests) : undefined,
  });
  res.json({ count: rooms.length, rooms: rooms.slice(0, 50) });
});

// GET /api/bookings/:ref
router.get('/bookings/:ref', (req, res) => {
  const booking = db.findBookingByRef(req.params.ref);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  res.json({ booking });
});

// DELETE /api/bookings/:ref
router.delete('/bookings/:ref', (req, res) => {
  const cancelled = db.cancelBooking(req.params.ref);
  if (!cancelled) return res.status(404).json({ error: 'Booking not found' });
  res.json({ booking: cancelled });
});

// GET /api/cities
router.get('/cities', (req, res) => {
  res.json({ cities: db.cities });
});

// GET /api/stats
router.get('/stats', (req, res) => {
  res.json(db.stats());
});

module.exports = router;
