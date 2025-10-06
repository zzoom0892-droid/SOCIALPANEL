const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

app.use('/api/deposit', require('../routes/deposit'));

app.listen(5500, () => console.log('Server running on port 5500'));