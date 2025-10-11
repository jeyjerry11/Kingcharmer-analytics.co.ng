// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json());

// ✅ MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 
  'mongodb+srv://KingCharmerStreeming:Asdf0909@cluster0.il7ja6v.mongodb.net/kc_streaming?retryWrites=true&w=majority&appName=Cluster0';

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

const UsageSchema = new mongoose.Schema({
  provider: String,
  earnings: Number
});

// Optional View schema (for total view count)
const ViewSchema = new mongoose.Schema({
  videoId: String,
  userId: String,
  timestamp: { type: Date, default: Date.now }
});

// 🧩 Models
const StreamLog = mongoose.model('StreamLog', StreamSchema);
const DownloadLog = mongoose.model('DownloadLog', DownloadSchema);
const Video = mongoose.model('Video', VideoSchema);
const UsageModel = mongoose.model('Usage', UsageSchema);
const View = mongoose.model('View', ViewSchema);

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
    const dataGB = dataMB / 1024;
    const hours = totalSeconds / 3600;

    // Simulated breakdown by provider
    const response = {
      airtel: { users: 123, hours: hours.toFixed(2), data: (dataGB * 0.2).toFixed(2) },
      mtn: { users: 214, hours: hours.toFixed(2), data: (dataGB * 0.3).toFixed(2) },
      glo: { users: 88, hours: hours.toFixed(2), data: (dataGB * 0.25).toFixed(2) },
      mobile9: { users: 61, hours: hours.toFixed(2), data: (dataGB * 0.15).toFixed(2) },
      spectra: { users: 32, hours: hours.toFixed(2), data: (dataGB * 0.1).toFixed(2) }
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

// 4️⃣ Get provider-specific balance
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

// 5️⃣ 📊 Summary route for global dashboard
app.get("/api/summary", async (req, res) => {
  try {
    const totalViews = await View.countDocuments();
    const totalStreams = await StreamLog.countDocuments();
    const totalDownloads = await DownloadLog.countDocuments();

    res.json({
      views: totalViews,
      streams: totalStreams,
      downloads: totalDownloads
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

//
// 🚀 START SERVER
//
const PORT = process.env.PORT || 12000;
app.listen(PORT, () => console.log(`🚀 King Charmer Analytics running on port ${PORT}`));
// 6️⃣ Email Verification Route
app.post("/api/send-verification-email", async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ success: false, message: "Email and code required" });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"King Charmer Network" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🔐 King Charmer Withdrawal Verification Code",
      html: `
        <div style="font-family: Poppins, sans-serif; background:#f9f9ff; padding:20px; border-radius:10px;">
          <h2 style="color:#00b7ff;">King Charmer Network Verification</h2>
          <p>Use the verification code below to confirm your withdrawal request:</p>
          <h1 style="letter-spacing:5px; background:#000; color:#00ffff; padding:10px 20px; border-radius:10px; display:inline-block;">
            ${code}
          </h1>
          <p>This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
          <p style="color:#666;">© 2025 King Charmer Network — Secure Analytics Division</p>
        </div>
      `,
    });

    res.json({ success: true, message: "✅ Verification email sent successfully!" });
  } catch (err) {
    console.error("❌ Verification email error:", err);
    res.status(500).json({ success: false, message: "Failed to send verification email." });
  }
});