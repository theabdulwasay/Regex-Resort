const express = require('express');
const path = require('path');
const chatRoute = require('./routes/chat');
const hotelsRoute = require('./routes/hotels');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/chat', chatRoute);
app.use('/api', hotelsRoute);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Hotel Concierge chatbot running at http://localhost:${PORT}`);
});
