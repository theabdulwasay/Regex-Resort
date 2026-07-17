# 🏨 Regex-Resort

### *intelligent hotel concierge — rule-based, lightning-fast, zero API bills*

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="MIT" />
  <img src="https://img.shields.io/badge/AI-Rule--Based-gold?style=for-the-badge" alt="Rule-Based" />
</p>

<p align="center">
  <b>Portico</b> is a production-ready hotel assistant chatbot with a 10,000+ record dataset,<br />
  multi-turn booking flows, a clean REST API, and a polished concierge-desk UI —<br />
  <em>no ML, no LLM calls, fully deterministic.</em>
</p>

---

## ✨ Features

| | |
|---|---|
| 🗣️ **Natural chat** | Book rooms, check availability, cancel bookings, ask FAQs |
| 🧠 **Rule engine** | Intent matching + entity extraction + slot-filling dialogue |
| 📊 **Big dataset** | 50 hotels · 10,000 rooms · 600 bookings · 17 FAQs |
| 💬 **Multi-turn flows** | City → room type → dates → pick → name → confirm |
| ⚡ **Zero AI cost** | No OpenAI / Claude / external NLP APIs |
| 🎨 **Concierge UI** | Elegant lobby-style chat experience |

---

## 🚀 Quick Start

```bash
# 1️⃣ Install dependencies
npm install

# 2️⃣ Generate the 10,667-record dataset
npm run seed

# 3️⃣ Launch the server
npm start
```

🌐 Open **[http://localhost:3000](http://localhost:3000)** and start chatting!

For auto-reload during development:

```bash
npm run dev
```

---

## 🏗️ Tech Stack

| Layer | Tech | Notes |
|:------|:-----|:------|
| 💾 **Data** | JSON (deterministic seed) | 50 hotels, 10k rooms, FAQs, bookings |
| ⚙️ **Backend** | Node.js + Express | Rule/regex NLP + in-memory indexed DB |
| 🖥️ **Frontend** | Vanilla HTML / CSS / JS | No framework — fast & easy to theme |
| 🔄 **Dialogue** | Slot-filling state machine | Booking, cancel & status lookup |

---

## 📁 Project Structure

```
portico/
├── 📦 package.json
├── 🖥️ server/
│   ├── index.js              # Express entry point
│   ├── db.js                 # In-memory data layer + indexes
│   ├── 📂 data/
│   │   ├── generate.js       # Dataset generator (npm run seed)
│   │   ├── hotels.json       # 50 hotels · 10 cities
│   │   ├── rooms.json        # 10,000 rooms
│   │   ├── faqs.json         # 17 knowledge-base entries
│   │   └── bookings.json     # 600 sample bookings
│   ├── 📂 nlp/
│   │   └── ruleEngine.js     # Intent · entities · dialogue manager
│   └── 📂 routes/
│       ├── chat.js           # POST /api/chat
│       └── hotels.js         # Hotels · rooms · bookings · stats
└── 🌐 public/
    ├── index.html
    ├── css/style.css         # Concierge desk visual theme
    └── js/app.js             # Chat UI (fetch-based)
```

---

## 🧩 How the Rule Engine Works

```
📨 Message  →  🎯 Intent Match  →  🔍 Entity Extract  →  🗂️ Dialogue Manager  →  💬 Reply
```

1. **🎯 Intent matching** — weighted regex/keyword patterns pick the best intent  
   *(greeting, book_room, availability, cancel, FAQ, complaint, …)*
2. **🔍 Entity extraction** — pulls city, room type, price, guests, dates, booking refs  
3. **📚 FAQ matching** — keyword-indexed KB (check-in, pets, parking, WiFi, …)  
4. **🗂️ Session store** — in-memory `Map` tracks `stage` + `slots` for multi-turn flows  

> ✅ Fully deterministic · auditable · cheap to run at scale

---

## 🔌 REST API

| Method | Endpoint | Description |
|:------:|:---------|:------------|
| `POST` | `/api/chat` | `{ sessionId, message }` → bot reply |
| `GET` | `/api/hotels?city=` | List hotels (optional city filter) |
| `GET` | `/api/hotels/:id` | Hotel detail |
| `GET` | `/api/rooms/search` | Search by city, type, price, guests |
| `GET` | `/api/bookings/:ref` | Lookup booking (`HTL-100123`) |
| `DELETE` | `/api/bookings/:ref` | Cancel a booking |
| `GET` | `/api/cities` | Served cities |
| `GET` | `/api/stats` | Dataset counts |

---

## 💬 Sample Conversation

```text
👤  I want to book a room
🤖  Great, let's get you booked! Which city would you like to stay in?

👤  Dubai
🤖  Got it, Dubai. What room type would you like?

👤  Deluxe
🤖  When would you like to check in and check out?

👤  3 nights
🤖  Here are available rooms in Dubai…

👤  1
🤖  Nice choice! What name should the reservation be under?

👤  Ahmed Khan
🤖  Please confirm this booking…

👤  yes confirm
🤖  🎉 Booking confirmed! Reference: HTL-100602
```

---

## 🛠️ Extending to Production

- **🗄️ Swap the data layer** — replace JSON via `server/db.js` with Postgres/Mongo  
- **☁️ Persist sessions** — back the in-memory `Map` with Redis for multi-instance deploys  
- **➕ Add intents** — append patterns in `ruleEngine.js` + a `case` in `respond()`  
- **🔒 Harden** — add Helmet, rate-limiting, and auth before public deploy  

---

## 📜 License

MIT © Regex-Resort — free to use, modify, and ship.

---

<p align="center">
  <b>🚪 Walk through the Portico — hospitality, automated.</b><br />
  <sub>Made with ❤️ for hotels, guests & developers</sub>
</p>
