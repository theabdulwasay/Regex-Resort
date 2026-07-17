const express = require('express');
const router = express.Router();
const { respond } = require('../nlp/ruleEngine');

// POST /api/chat  { sessionId, message }
router.post('/', (req, res) => {
  const { sessionId, message } = req.body || {};
  if (!sessionId || typeof message !== 'string') {
    return res.status(400).json({ error: 'sessionId and message are required' });
  }
  try {
    const reply = respond(sessionId, message);
    res.json({ reply });
  } catch (err) {
    console.error('Chat engine error:', err);
    res.status(500).json({ error: 'Something went wrong processing your message.' });
  }
});

module.exports = router;
