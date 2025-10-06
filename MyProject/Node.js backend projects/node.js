
require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const USERS_FILE = 'users.json';

app.use(cors());
app.use(express.json());

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

// Moniepoint account creation endpoint
app.post('/api/moniepoint-create-account', async (req, res) => {
  const { name, phone } = req.body;
  const apiSecret = process.env.MONIEPOINT_API_SECRET;
  try {
    const response = await axios.post(
      'https://api.moniepoint.com/v1/business/account/generate',
      {
        account_name: name,
        phone_number: phone
        // Add other required fields as per Moniepoint API docs
      },
      {
        headers: {
          Authorization: `Bearer ${apiSecret}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json({
      accountNumber: response.data.accountNumber || response.data.data.accountNumber,
      bankName: response.data.bankName || response.data.data.bankName || 'Moniepoint',
      accountName: response.data.accountName || response.data.data.accountName || name
    });
  } catch (err) {
    res.status(500).json({ error: 'Moniepoint API error', details: err.message });
  }
});

// Moniepoint payment webhook
app.post('/api/moniepoint-webhook', (req, res) => {
  const event = req.body;
  if (event.status === "successful") {
    let users = [];
    if (fs.existsSync(USERS_FILE)) {
      users = JSON.parse(fs.readFileSync(USERS_FILE));
    }
    const user = users.find(u => u.name === event.account_name);
    if (user) {
      user.balance = (user.balance || 0) + event.amount;
      fs.writeFileSync(USERS_FILE, JSON.stringify(users));
    }
    // Update dashboard balance
    let balanceData = { balance: 0, transactions: [] };
    if (fs.existsSync('balance.json')) {
      balanceData = JSON.parse(fs.readFileSync('balance.json'));
    }
    balanceData.balance += Number(event.amount);
    balanceData.transactions.push({ phone: event.account_name, amount: event.amount, date: new Date().toISOString(), type: 'webhook' });
    fs.writeFileSync('balance.json', JSON.stringify(balanceData, null, 2));
  }
  res.sendStatus(200);
});

// Add Funds via Moniepoint Business Bank
app.post('/api/addfunds', async (req, res) => {
  const { phone, amount } = req.body;
  if (!phone || !amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Valid phone and amount required.' });
  }
  const apiSecret = process.env.MONIEPOINT_API_SECRET;
  try {
    const mpResponse = await axios.post(
      'https://api.moniepoint.com/v1/business/account/generate',
      {
        account_name: phone,
        phone_number: phone,
        amount
      },
      {
        headers: {
          Authorization: `Bearer ${apiSecret}`,
          'Content-Type': 'application/json'
        }
      }
    );
    let balanceData = { balance: 0, transactions: [] };
    if (fs.existsSync('balance.json')) {
      balanceData = JSON.parse(fs.readFileSync('balance.json'));
    }
    balanceData.balance += Number(amount);
    balanceData.transactions.push({ phone, amount, date: new Date().toISOString(), type: 'addfunds' });
    fs.writeFileSync('balance.json', JSON.stringify(balanceData, null, 2));
    res.json({
      success: true,
      moniepoint: mpResponse.data,
      newBalance: balanceData.balance
    });
  } catch (err) {
    res.status(500).json({ error: 'Moniepoint API error', details: err.message });
  }
});

app.listen(5050, () => {
  console.log('Server running on port 5050');
});