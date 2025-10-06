require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const USERS_FILE = 'users.json';

app.use(cors());
app.use(express.json());

// Moniepoint direct business API endpoint for account generation
app.post('/api/moniepoint-account', async (req, res) => {
  const { amount, email } = req.body;
  const apiSecret = process.env.MONIEPOINT_API_SECRET;
  try {
    // Replace this with Moniepoint's real endpoint and payload
    const response = await axios.post(
      'https://api.moniepoint.com/v1/business/account/generate', // Example endpoint
      {
        amount,
        email,
        // Add other required fields based on Moniepoint API docs
      },
      {
        headers: {
          Authorization: `Bearer ${apiSecret}`,
          'Content-Type': 'application/json'
        }
      }
    );
    // Adjust response mapping based on Moniepoint's API response
    res.json({
      accountNumber: response.data.accountNumber || response.data.data.accountNumber,
      bankName: response.data.bankName || response.data.data.bankName,
      accountName: response.data.accountName || response.data.data.accountName
    });
  } catch (err) {
    res.status(500).json({ error: 'Moniepoint API error', details: err.message });
  }
});

// Signup endpoint
app.post('/api/signup', (req, res) => {
  const { email, password, name } = req.body;
  let users = [];
  if (fs.existsSync(USERS_FILE)) {
    users = JSON.parse(fs.readFileSync(USERS_FILE));
  }
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Email already exists' });
  }
  users.push({ email, password, name, balance: 0 });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users));
  res.json({ success: true });
});

// Login endpoint
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  let users = [];
  if (fs.existsSync(USERS_FILE)) {
    users = JSON.parse(fs.readFileSync(USERS_FILE));
  }
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ success: true, name: user.name, balance: user.balance || 0 });
});

// Moniepoint webhook for funding wallet
app.post('/api/moniepoint-webhook', (req, res) => {
  const event = req.body;
  // Example: event contains { email, amount, status }
  if (event.status === "successful") {
    let users = [];
    if (fs.existsSync(USERS_FILE)) {
      users = JSON.parse(fs.readFileSync(USERS_FILE));
    }
    const user = users.find(u => u.email === event.email);
    if (user) {
      user.balance = (user.balance || 0) + event.amount;
      fs.writeFileSync(USERS_FILE, JSON.stringify(users));
    }
  }
  res.sendStatus(200);
});

app.listen(5050, () => {
  console.log('Server running on port 5050');
});