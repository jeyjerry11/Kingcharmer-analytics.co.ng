// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors({
  origin: '*', // ✅ Allow all for now (you can later restrict to your domain)
  methods: ['GET', 'POST']
}));
app.use(express.json());

// ✅ MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://KingCharmerStreeming:Asdf0909@cluster0.il7ja6v.mongodb.net/kc_streaming?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected to KC Streaming'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// 🧠 Schemas
const StreamSchema = new mongoose.Schema({
  videoId: String,
  seconds: Number,
  provider: String,
  timestamp: { type: Date, default: Date.now }
});

const DownloadSchema = new mongoose.Schema({
  videoId: String,
  size: Number,
  timestamp: { type: Date, default: Date.now }
});

const VideoSchema = new mongoose.Schema({
  title: String,
  url: String,
  uploadSize: Number,
  createdAt: { type: Date, default: Date.now }
});

// 🆕 Define Usage Model (to store provider-specific earnings)
const UsageSchema = new mongoose.Schema({
  provider: String,
  earnings: Number
});

const StreamLog = mongoose.model('StreamLog', StreamSchema);
const DownloadLog = mongoose.model('DownloadLog', DownloadSchema);
const Video = mongoose.model('Video', VideoSchema);
const UsageModel = mongoose.model('Usage', UsageSchema);

//
// 🌐 ROUTES
//

// 1️⃣ Default route
app.get('/', (req, res) => {
  res.send('📊 King Charmer Streaming Backend is live & connected!');
});

// 2️⃣ Streaming analytics summary
app.get('/api/analytics', async (req, res) => {
  try {
    const streamData = await StreamLog.aggregate([
      { $group: { _id: null, totalSeconds: { $sum: "$seconds" } } }
    ]);

    const totalSeconds = streamData[0]?.totalSeconds || 0;
    const dataMB = totalSeconds * 1.5; // 1.5 MB/sec rule
    const dataGB = (dataMB / 1024).toFixed(2);
    const hours = (totalSeconds / 3600).toFixed(2);

    // Simulated breakdown by provider
    const response = {
      airtel: { users: 123, hours, data: (dataGB * 0.2).toFixed(2) },
      mtn: { users: 214, hours, data: (dataGB * 0.3).toFixed(2) },
      glo: { users: 88, hours, data: (dataGB * 0.25).toFixed(2) },
      mobile9: { users: 61, hours, data: (dataGB * 0.15).toFixed(2) },
      spectra: { users: 32, hours, data: (dataGB * 0.1).toFixed(2) }
    };

    res.json(response);
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Failed to get analytics data" });
  }
});

// 3️⃣ Withdrawal email route
app.post("/api/send-withdraw-email", async (req, res) => {
  const { provider, accountNumber, accountName, bankName, amount, email, phone, companyEmail, currentBalance } = req.body;

  const message = `
💰 Withdrawal Request from King Charmer Platform

Provider: ${provider}
Requested By: ${accountName}
Bank Name: ${bankName}
Account Number: ${accountNumber}
Phone: ${phone}
Email: ${email}
Amount to Withdraw: ₦${amount}
Current Balance: ₦${currentBalance}

📊 This request came from the King Charmer Streaming analytics system.
`;

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
    });

    await transporter.sendMail({
      from: `"King Charmer Analytics" <${process.env.EMAIL_USER}>`,
      to: companyEmail,
      subject: `Withdrawal Request - ${provider} Network`,
      text: message,
    });

    res.json({ success: true, message: "✅ Withdrawal email sent successfully!" });
  } catch (err) {
    console.error("❌ Email error:", err);
    res.status(500).json({ success: false, message: "Failed to send email." });
  }
});

// 4️⃣ Get provider-specific balance (based on Usage collection)
app.get("/api/withdraw/:provider", async (req, res) => {
  try {
    const { provider } = req.params;
    const usageData = await UsageModel.findOne({ provider });

    res.json({ 
      provider, 
      balance: usageData ? usageData.earnings : 0 
    });
  } catch (err) {
    console.error("Balance fetch error:", err);
    res.status(500).json({ error: "Failed to load provider balance." });
  }
});

//
// 🚀 START SERVER
//
const PORT = process.env.PORT || 12000;
app.listen(PORT, () => console.log(`🚀 King Charmer Analytics running on port ${PORT}`));