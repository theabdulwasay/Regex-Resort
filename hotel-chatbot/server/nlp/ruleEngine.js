/**
 * ruleEngine.js
 * A fully rule-based (no ML) conversational engine for the hotel bot.
 *
 *  1. matchIntent()   - keyword/regex scoring to pick the best intent
 *  2. extractEntities() - regex-driven slot extraction (city, dates, price, etc.)
 *  3. SessionStore     - per-session memory so booking is a multi-turn flow
 *  4. respond()         - the dialogue manager that ties it all together
 */
const db = require('../db');

// ---------------------------------------------------------------------------
// 1. INTENTS — each has weighted keyword/regex patterns.
// ---------------------------------------------------------------------------
const INTENTS = [
  {
    name: 'greeting',
    patterns: [/\b(hi|hello|hey|good (morning|afternoon|evening)|salaam|assalam)\b/i],
    weight: 3,
  },
  {
    name: 'farewell',
    patterns: [/\b(bye|goodbye|see you|that'?s all|no more questions|exit|quit)\b/i],
    weight: 3,
  },
  {
    name: 'thanks',
    patterns: [/\b(thanks|thank you|appreciated|shukriya)\b/i],
    weight: 3,
  },
  {
    name: 'help',
    patterns: [/\b(help|what can you do|options|menu|commands)\b/i],
    weight: 2,
  },
  {
    name: 'room_availability',
    patterns: [
      /\b(available|availability|vacant|free room|any rooms?)\b/i,
      /\b(search|find|look for)\b.*\broom/i,
      /\broom(s)?\b.*\bin\b/i,
    ],
    weight: 3,
  },
  {
    name: 'price_inquiry',
    patterns: [/\b(price|cost|rate|how much|charges|per night|budget)\b/i],
    weight: 2,
  },
  {
    name: 'book_room',
    patterns: [/\b(book|reserve|reservation|i want to stay|i'?d like to book)\b/i],
    weight: 4,
  },
  {
    name: 'cancel_booking',
    patterns: [/\b(cancel)\b/i],
    weight: 4,
  },
  {
    name: 'booking_status',
    patterns: [/\b(booking status|my booking|check my reservation|booking ref|confirmation number)\b/i, /\bHTL-\d+\b/i],
    weight: 3,
  },
  {
    name: 'amenities',
    patterns: [/\b(amenities|facilities|features|does it have|gym|pool|spa|wifi|parking)\b/i],
    weight: 2,
  },
  {
    name: 'hotel_info',
    patterns: [/\b(tell me about|hotel info|star rating|address|location of)\b/i],
    weight: 2,
  },
  {
    name: 'complaint',
    patterns: [/\b(complaint|complain|unhappy|bad experience|dirty|rude|broken|not working|issue with my room)\b/i],
    weight: 4,
  },
  {
    name: 'faq',
    // no direct pattern weight boost; FAQ matching happens via keyword table below
    patterns: [],
    weight: 0,
  },
];

function matchIntent(text) {
  const scores = {};
  for (const intent of INTENTS) {
    let score = 0;
    for (const pattern of intent.patterns) {
      if (pattern.test(text)) score += intent.weight;
    }
    if (score > 0) scores[intent.name] = score;
  }

  // FAQ keyword table also contributes to intent scoring
  const faqHit = matchFAQ(text);
  if (faqHit) scores.faq = (scores.faq || 0) + 3;

  let best = null;
  let bestScore = 0;
  for (const [name, score] of Object.entries(scores)) {
    if (score > bestScore) {
      best = name;
      bestScore = score;
    }
  }
  return { intent: best || 'fallback', score: bestScore, faqHit };
}

function matchFAQ(text) {
  const lower = text.toLowerCase().replace(/-/g, ' ');
  let best = null;
  let bestHits = 0;
  for (const faq of db.faqs) {
    let hits = 0;
    for (const kw of faq.keywords) {
      if (lower.includes(kw)) hits++;
    }
    if (hits > bestHits) {
      bestHits = hits;
      best = faq;
    }
  }
  return bestHits > 0 ? best : null;
}

// ---------------------------------------------------------------------------
// 2. ENTITY EXTRACTION
// ---------------------------------------------------------------------------
const ROOM_TYPE_WORDS = ['single', 'double', 'twin', 'deluxe', 'executive suite', 'family suite', 'presidential suite', 'suite'];

function extractEntities(text) {
  const lower = text.toLowerCase();
  const entities = {};

  const city = db.findCityMention(text);
  if (city) entities.city = city;

  const roomType = ROOM_TYPE_WORDS.find((t) => lower.includes(t));
  if (roomType) entities.roomType = roomType;

  const priceMatch = lower.match(/(under|below|less than|max|maximum)\s*\$?(\d+)/);
  if (priceMatch) entities.maxPrice = Number(priceMatch[2]);
  const priceOverMatch = lower.match(/(over|above|more than|min|minimum)\s*\$?(\d+)/);
  if (priceOverMatch) entities.minPrice = Number(priceOverMatch[2]);
  const plainPrice = lower.match(/\$\s?(\d+)/);
  if (plainPrice && !entities.maxPrice) entities.maxPrice = Number(plainPrice[1]);

  const guestsMatch = lower.match(/(\d+)\s*(guests?|people|persons?|adults?)/);
  if (guestsMatch) entities.guests = Number(guestsMatch[1]);

  const dateMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/g);
  if (dateMatch) {
    entities.checkIn = dateMatch[0];
    if (dateMatch[1]) entities.checkOut = dateMatch[1];
  }
  if (/\btonight\b/i.test(text)) entities.checkIn = new Date().toISOString().slice(0, 10);
  if (/\btomorrow\b/i.test(text)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    entities.checkIn = d.toISOString().slice(0, 10);
  }

  const nightsMatch = lower.match(/(\d+)\s*night/);
  if (nightsMatch) entities.nights = Number(nightsMatch[1]);

  const refMatch = text.match(/\bHTL-\d+\b/i);
  if (refMatch) entities.bookingRef = refMatch[0].toUpperCase();

  return entities;
}

// ---------------------------------------------------------------------------
// 3. SESSION STORE — per-session slot memory for multi-turn booking flow
// ---------------------------------------------------------------------------
const sessions = new Map();
function getSession(id) {
  if (!sessions.has(id)) {
    sessions.set(id, { stage: null, slots: {}, lastRooms: [] });
  }
  return sessions.get(id);
}

// ---------------------------------------------------------------------------
// 4. RESPONSE HELPERS
// ---------------------------------------------------------------------------
function fmtRoom(r) {
  return `#${r.roomNumber} · ${r.type} @ ${r.hotelName} (${r.city}) — $${r.pricePerNight}/night, sleeps ${r.capacity}`;
}

function roomListReply(rooms, ctxLabel) {
  if (rooms.length === 0) {
    return {
      text: `I couldn't find any available rooms${ctxLabel ? ' ' + ctxLabel : ''}. Try a different city, room type, or budget.`,
      quickReplies: ['Search all cities', 'Show room types', 'Talk to a human'],
    };
  }
  const top = rooms.slice(0, 5);
  const lines = top.map((r, i) => `${i + 1}. ${fmtRoom(r)}`).join('\n');
  return {
    text: `I found ${rooms.length} available room(s)${ctxLabel ? ' ' + ctxLabel : ''}. Here are the top matches:\n\n${lines}${rooms.length > 5 ? `\n\n...and ${rooms.length - 5} more.` : ''}\n\nWant to book one? Just say "book room 1" or give me the room number.`,
    quickReplies: ['Book room 1', 'Narrow by price', 'Change city'],
    rooms: top,
  };
}

// ---------------------------------------------------------------------------
// 5. DIALOGUE MANAGER
// ---------------------------------------------------------------------------
function respond(sessionId, rawText) {
  const text = (rawText || '').trim();
  const session = getSession(sessionId);
  const entities = extractEntities(text);

  // ---- Continue an in-progress booking flow first ----
  if (session.stage) {
    return continueBooking(session, text, entities);
  }

  const { intent, faqHit } = matchIntent(text);

  switch (intent) {
    case 'greeting':
      return {
        text: "Hello! Welcome to Concierge — your hotel assistant. I can help you check room availability, prices, amenities, and book a stay. What are you looking for today?",
        quickReplies: ['Find a room', 'Check prices', 'Hotel amenities', 'My booking'],
      };

    case 'farewell':
      return { text: 'Thank you for visiting! Have a wonderful stay, and feel free to come back anytime you need help. 🌙', quickReplies: [] };

    case 'thanks':
      return { text: "You're very welcome! Is there anything else I can help you with?", quickReplies: ['Find a room', 'FAQs', 'No, that\'s all'] };

    case 'help':
      return {
        text: 'Here is what I can do:\n• Search room availability by city, type, budget, or guests\n• Quote prices per night\n• List hotel amenities & facilities\n• Book a room (multi-step)\n• Look up or cancel a booking by reference (e.g. HTL-100123)\n• Answer FAQs about check-in, cancellation, parking, pets, etc.',
        quickReplies: ['Find a room', 'FAQs', 'Book a room'],
      };

    case 'room_availability': {
      const results = db.searchRooms({
        city: entities.city,
        type: entities.roomType,
        maxPrice: entities.maxPrice,
        minPrice: entities.minPrice,
        guests: entities.guests,
      });
      session.lastRooms = results;
      const label = entities.city ? `in ${entities.city}` : '';
      return roomListReply(results, label);
    }

    case 'price_inquiry': {
      const results = db.searchRooms({
        city: entities.city,
        type: entities.roomType,
        maxPrice: entities.maxPrice,
        minPrice: entities.minPrice,
      });
      if (results.length === 0) {
        return { text: "I don't have pricing for that exact combination. Try naming a city, e.g. 'prices for double rooms in Dubai'.", quickReplies: db.cities.slice(0, 4) };
      }
      const avg = Math.round((results.reduce((s, r) => s + r.pricePerNight, 0) / results.length) * 100) / 100;
      const min = Math.min(...results.map((r) => r.pricePerNight));
      const max = Math.max(...results.map((r) => r.pricePerNight));
      session.lastRooms = results;
      return {
        text: `${entities.roomType ? entities.roomType[0].toUpperCase() + entities.roomType.slice(1) : 'Room'} prices${entities.city ? ' in ' + entities.city : ''}: from $${min} to $${max} per night (avg $${avg}), across ${results.length} available room(s).`,
        quickReplies: ['Show me the cheapest', 'Book a room', 'Change city'],
      };
    }

    case 'book_room':
      session.stage = 'booking_city';
      session.slots = {};
      return {
        text: "Great, let's get you booked! Which city would you like to stay in?",
        quickReplies: db.cities.slice(0, 4),
      };

    case 'cancel_booking':
      if (entities.bookingRef) {
        const cancelled = db.cancelBooking(entities.bookingRef);
        if (cancelled) {
          return { text: `Booking ${cancelled.bookingRef} has been cancelled. If you were charged, a refund will be processed per our cancellation policy.`, quickReplies: ['Book a new room', 'Cancellation policy'] };
        }
        return { text: `I couldn't find a booking with reference ${entities.bookingRef}. Please double-check the reference code.`, quickReplies: [] };
      }
      session.stage = 'cancel_ref';
      return { text: 'Sure — what is your booking reference? (format: HTL-XXXXXX)', quickReplies: [] };

    case 'booking_status':
      if (entities.bookingRef) {
        const booking = db.findBookingByRef(entities.bookingRef);
        if (booking) {
          return {
            text: `Booking ${booking.bookingRef}: ${booking.roomType} at ${booking.hotelName}, ${booking.checkIn} → ${booking.checkOut} (${booking.nights} night(s)), total $${booking.totalPrice}. Status: ${booking.status}.`,
            quickReplies: ['Cancel this booking', 'Book another room'],
          };
        }
        return { text: `No booking found with reference ${entities.bookingRef}.`, quickReplies: [] };
      }
      session.stage = 'status_ref';
      return { text: 'What is your booking reference number? (format: HTL-XXXXXX)', quickReplies: [] };

    case 'amenities': {
      if (entities.city) {
        const hotelsInCity = db.findHotelsByCity(entities.city);
        if (hotelsInCity.length) {
          const lines = hotelsInCity.slice(0, 3).map((h) => `• ${h.name}: ${h.facilities.slice(0, 5).join(', ')}`).join('\n');
          return { text: `Facilities at hotels in ${entities.city}:\n${lines}`, quickReplies: ['Find a room', 'Prices'] };
        }
      }
      return { text: 'Our hotels typically offer WiFi, fitness centers, pools, spa access, and 24h room service — facilities vary per property. Tell me a city and I\'ll list specifics.', quickReplies: db.cities.slice(0, 4) };
    }

    case 'hotel_info': {
      if (entities.city) {
        const hotelsInCity = db.findHotelsByCity(entities.city);
        if (hotelsInCity.length) {
          const lines = hotelsInCity.slice(0, 5).map((h) => `• ${h.name} — ${h.stars}★, rating ${h.rating}/5 (${h.reviewCount} reviews)`).join('\n');
          return { text: `Hotels in ${entities.city}:\n${lines}`, quickReplies: ['Find a room', 'Amenities'] };
        }
      }
      return { text: `We operate in: ${db.cities.join(', ')}. Which city interests you?`, quickReplies: db.cities.slice(0, 4) };
    }

    case 'complaint':
      return {
        text: "I'm really sorry to hear that. I've logged this so our guest relations team can follow up personally. Could you share your booking reference and a short description so we can escalate immediately?",
        quickReplies: ['I have a booking ref', 'Speak to a manager'],
      };

    case 'faq':
      if (faqHit) return { text: faqHit.answer, quickReplies: ['Another question', 'Find a room'] };
      break;

    default:
      break;
  }

  return {
    text: "I didn't quite catch that. I can help with room availability, prices, amenities, bookings, or general questions (check-in time, cancellation policy, parking, etc). Could you rephrase, or pick an option below?",
    quickReplies: ['Find a room', 'FAQs', 'Book a room', 'Help'],
  };
}

// ---------------------------------------------------------------------------
// Multi-turn booking / cancel / status flows
// ---------------------------------------------------------------------------
function continueBooking(session, text, entities) {
  switch (session.stage) {
    case 'booking_city': {
      const city = entities.city || db.cities.find((c) => text.toLowerCase().includes(c.toLowerCase()));
      if (!city) return { text: `Sorry, I don't recognize that city. We operate in: ${db.cities.join(', ')}. Which one?`, quickReplies: db.cities.slice(0, 4) };
      session.slots.city = city;
      session.stage = 'booking_type';
      return { text: `Got it, ${city}. What room type would you like? (Single, Double, Twin, Deluxe, Executive Suite, Family Suite, Presidential Suite)`, quickReplies: ['Double', 'Deluxe', 'Executive Suite', 'Any'] };
    }
    case 'booking_type': {
      const type = ROOM_TYPE_WORDS.find((t) => text.toLowerCase().includes(t)) || (/any/i.test(text) ? null : null);
      session.slots.roomType = type || undefined;
      session.stage = 'booking_dates';
      return { text: 'When would you like to check in and check out? (e.g. "2026-08-10 to 2026-08-13", or just say "3 nights")', quickReplies: ['Tomorrow, 2 nights', '3 nights', 'This weekend'] };
    }
    case 'booking_dates': {
      let checkIn = entities.checkIn;
      let nights = entities.nights || 1;
      if (!checkIn) {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        checkIn = d.toISOString().slice(0, 10);
      }
      const checkOutDate = new Date(checkIn);
      checkOutDate.setDate(checkOutDate.getDate() + nights);
      session.slots.checkIn = checkIn;
      session.slots.checkOut = entities.checkOut || checkOutDate.toISOString().slice(0, 10);
      session.slots.nights = nights;
      session.stage = 'booking_search';
      // fallthrough into search immediately
      return performBookingSearch(session);
    }
    case 'booking_pick': {
      const idx = parseInt(text.match(/\d+/)?.[0], 10);
      const chosen = session.lastRooms?.[(idx || 1) - 1];
      if (!chosen) {
        return { text: 'Please tell me the room number from the list (e.g. "1") to proceed.', quickReplies: ['1', '2', '3'] };
      }
      session.slots.roomId = chosen.id;
      session.slots.roomSummary = fmtRoom(chosen);
      session.stage = 'booking_name';
      return { text: `Nice choice: ${fmtRoom(chosen)}. What name should the reservation be under?`, quickReplies: [] };
    }
    case 'booking_name': {
      session.slots.guestName = text.trim() || 'Guest';
      session.stage = 'booking_confirm';
      const s = session.slots;
      return {
        text: `Please confirm:\n• Guest: ${s.guestName}\n• Room: ${s.roomSummary}\n• Check-in: ${s.checkIn}\n• Check-out: ${s.checkOut}\n\nShall I confirm this booking?`,
        quickReplies: ['Yes, confirm', 'Cancel'],
      };
    }
    case 'booking_confirm': {
      if (/^y|yes|confirm|sure|ok/i.test(text)) {
        const s = session.slots;
        try {
          const booking = db.createBooking({
            guestName: s.guestName,
            roomId: s.roomId,
            checkIn: s.checkIn,
            checkOut: s.checkOut,
            guests: 1,
          });
          resetSession(session);
          return {
            text: `🎉 Booking confirmed! Reference: ${booking.bookingRef}\nTotal: $${booking.totalPrice} for ${booking.nights} night(s).\nA confirmation would normally be emailed to you. Is there anything else I can help with?`,
            quickReplies: ['Find another room', 'FAQs'],
          };
        } catch (e) {
          resetSession(session);
          return { text: `Sorry, that room just became unavailable. Let's search again — which city?`, quickReplies: db.cities.slice(0, 4) };
        }
      }
      resetSession(session);
      return { text: 'No problem, booking cancelled. Anything else I can help with?', quickReplies: ['Find a room', 'FAQs'] };
    }
    case 'cancel_ref': {
      const ref = entities.bookingRef || text.trim().toUpperCase();
      const cancelled = db.cancelBooking(ref);
      resetSession(session);
      if (cancelled) return { text: `Booking ${cancelled.bookingRef} has been cancelled.`, quickReplies: ['Book a new room'] };
      return { text: `I couldn't find a booking with reference ${ref}.`, quickReplies: [] };
    }
    case 'status_ref': {
      const ref = entities.bookingRef || text.trim().toUpperCase();
      const booking = db.findBookingByRef(ref);
      resetSession(session);
      if (booking) {
        return {
          text: `Booking ${booking.bookingRef}: ${booking.roomType} at ${booking.hotelName}, ${booking.checkIn} → ${booking.checkOut} (${booking.nights} night(s)), total $${booking.totalPrice}. Status: ${booking.status}.`,
          quickReplies: ['Cancel this booking'],
        };
      }
      return { text: `No booking found with reference ${ref}.`, quickReplies: [] };
    }
    default:
      resetSession(session);
      return { text: "Let's start over — what would you like to do?", quickReplies: ['Find a room', 'Book a room', 'FAQs'] };
  }
}

function performBookingSearch(session) {
  const s = session.slots;
  const results = db.searchRooms({ city: s.city, type: s.roomType });
  session.lastRooms = results.slice(0, 5);
  if (results.length === 0) {
    session.stage = 'booking_city';
    return { text: `No available rooms found in ${s.city}${s.roomType ? ' (' + s.roomType + ')' : ''}. Let's try another city.`, quickReplies: db.cities.slice(0, 4) };
  }
  session.stage = 'booking_pick';
  const lines = session.lastRooms.map((r, i) => `${i + 1}. ${fmtRoom(r)}`).join('\n');
  return { text: `Here are available rooms in ${s.city} for ${s.checkIn} → ${s.checkOut}:\n\n${lines}\n\nWhich one would you like? (reply with the number)`, quickReplies: ['1', '2', '3'] };
}

function resetSession(session) {
  session.stage = null;
  session.slots = {};
}

module.exports = { respond, matchIntent, extractEntities, getSession };
