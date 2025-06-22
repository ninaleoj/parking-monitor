const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

const STATUS_FILE = path.join(__dirname, 'status.json');

const ADMIN_PIN = "hma112168"; 

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize status file if missing
function initStatus() {
  if (!fs.existsSync(STATUS_FILE)) {
    const emptyStatus = Array.from({ length: 50 }, () => ({
      reserved: false,
      reg: "",
      password: ""
    }));
    fs.writeFileSync(STATUS_FILE, JSON.stringify(emptyStatus, null, 2));
  }
}

function loadStatus() {
  initStatus();
  return JSON.parse(fs.readFileSync(STATUS_FILE));
}

function saveStatus(status) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
}

// Get full status
app.get('/api/status', (req, res) => {
  const status = loadStatus();
  res.json(status);
});

// Login or request to register
app.post('/api/login-slot', (req, res) => {
  const { slot, password } = req.body;
  const index = slot - 1;

  if (slot < 1 || slot > 50) {
    return res.status(400).json({ success: false, error: "Invalid slot number." });
  }

  const status = loadStatus();
  const entry = status[index];

  if (!entry.password) {
    return res.json({ success: false, needRegister: true });
  }

  if (entry.password === password) {
    const token = `slot${slot}-${password}`;
    return res.json({ success: true, token });
  }

  res.json({ success: false });
});

// Register password for a slot
app.post('/api/register', (req, res) => {
  const { slot, password } = req.body;
  const index = slot - 1;

  if (slot < 1 || slot > 50 || !password) {
    return res.status(400).json({ success: false, error: "Invalid data." });
  }

  const status = loadStatus();
  if (status[index].password) {
    return res.status(400).json({ success: false, error: "Password already set." });
  }

  status[index].password = password;
  saveStatus(status);

  const token = `slot${slot}-${password}`;
  res.json({ success: true, token });
});

// Toggle slot status
app.post('/api/toggle-slot', (req, res) => {
  const { slot, token, reg } = req.body;
  const index = slot - 1;

  if (slot < 1 || slot > 50) {
    return res.status(400).json({ success: false, error: "Invalid slot number." });
  }

  const status = loadStatus();
  const entry = status[index];
  const expectedToken = `slot${slot}-${entry.password}`;

  if (token !== expectedToken) {
    return res.status(403).json({ success: false, error: "Unauthorized" });
  }

  entry.reserved = !entry.reserved;
  entry.reg = entry.reserved ? (reg || "") : "";

  saveStatus(status);
  res.json({ success: true, status: entry });
});

// Admin login – returns a token if PIN matches
app.post('/api/admin/login', (req, res) => {
  const { pin } = req.body;
  if (pin === ADMIN_PIN) {
    return res.json({ success: true, token: `ADMIN-${pin}` });
  }
  res.json({ success: false });
});

// Admin reset: needs valid token
app.post('/api/admin/reset-password', (req, res) => {
  const { slot, token } = req.body;
  if (token !== `ADMIN-${ADMIN_PIN}`) {
    return res.status(403).json({ success: false, error: "Unauthorized" });
  }

  const index = slot - 1;
  if (slot < 1 || slot > 50) {
    return res.status(400).json({ success: false, error: "Invalid slot number" });
  }

  const status = loadStatus();
  status[index] = { reserved: false, reg: "", password: "" };
  saveStatus(status);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`🚗 Parking server running on http://localhost:${PORT}`);
});
