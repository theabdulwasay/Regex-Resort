(() => {
  const sessionId = 'sess-' + Math.random().toString(36).slice(2) + Date.now();

  const thread = document.getElementById('chatThread');
  const quickRepliesEl = document.getElementById('quickReplies');
  const composer = document.getElementById('composer');
  const input = document.getElementById('messageInput');
  const resetBtn = document.getElementById('resetBtn');
  const cityChips = document.getElementById('cityChips');
  const statEls = document.querySelectorAll('.stat-num');

  // ---------- load stats + cities for the ledger sidebar ----------
  async function loadLedger() {
    try {
      const [statsRes, citiesRes] = await Promise.all([
        fetch('/api/stats').then((r) => r.json()),
        fetch('/api/cities').then((r) => r.json()),
      ]);
      animateStat(statEls[0], statsRes.hotels);
      animateStat(statEls[1], statsRes.rooms);
      animateStat(statEls[2], statsRes.cities);
      animateStat(statEls[3], statsRes.bookings);

      cityChips.innerHTML = '';
      citiesRes.cities.forEach((city) => {
        const chip = document.createElement('button');
        chip.className = 'chip';
        chip.textContent = city;
        chip.addEventListener('click', () => sendMessage(`Show me available rooms in ${city}`));
        cityChips.appendChild(chip);
      });
    } catch (e) {
      console.error('Failed to load ledger stats', e);
    }
  }

  function animateStat(el, target) {
    const duration = 900;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased).toLocaleString();
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ---------- chat rendering ----------
  function timeNow() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function appendMessage(text, sender) {
    const wrap = document.createElement('div');
    wrap.className = `msg ${sender}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;
    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    meta.textContent = sender === 'user' ? `You · ${timeNow()}` : `Concierge · ${timeNow()}`;
    wrap.appendChild(bubble);
    wrap.appendChild(meta);
    thread.appendChild(wrap);
    thread.scrollTop = thread.scrollHeight;
    return wrap;
  }

  function showTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'msg bot typing';
    wrap.id = 'typingIndicator';
    wrap.innerHTML = '<div class="bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
    thread.appendChild(wrap);
    thread.scrollTop = thread.scrollHeight;
  }
  function hideTyping() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
  }

  function setQuickReplies(list) {
    quickRepliesEl.innerHTML = '';
    (list || []).forEach((label) => {
      const btn = document.createElement('button');
      btn.className = 'qr-btn';
      btn.textContent = label;
      btn.addEventListener('click', () => sendMessage(label));
      quickRepliesEl.appendChild(btn);
    });
  }

  async function sendMessage(text) {
    if (!text || !text.trim()) return;
    appendMessage(text, 'user');
    setQuickReplies([]);
    input.value = '';
    showTyping();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text }),
      });
      const data = await res.json();
      hideTyping();
      // tiny artificial delay for a natural feel
      setTimeout(() => {
        if (data.reply) {
          appendMessage(data.reply.text, 'bot');
          setQuickReplies(data.reply.quickReplies);
        } else {
          appendMessage(data.error || 'Something went wrong.', 'bot');
        }
      }, 120);
    } catch (e) {
      hideTyping();
      appendMessage('I lost connection to the front desk. Please try again in a moment.', 'bot');
    }
  }

  composer.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage(input.value);
  });

  resetBtn.addEventListener('click', () => {
    thread.innerHTML = '';
    setQuickReplies([]);
    sendMessage('hello');
  });

  document.querySelectorAll('.sample-list li').forEach((li) => {
    li.addEventListener('click', () => sendMessage(li.dataset.prompt));
  });

  // ---------- boot ----------
  loadLedger();
  appendMessage(
    "Hello! Welcome to Concierge — your hotel assistant. I can help you check room availability, prices, amenities, and book a stay. What are you looking for today?",
    'bot'
  );
  setQuickReplies(['Find a room', 'Check prices', 'Hotel amenities', 'My booking']);
})();
