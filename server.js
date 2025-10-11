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

const ViewSchema = new mongoose.Schema({
  videoId: String,
  userId: String,
  provider: String,
  timestamp: { type: Date, default: Date.now }
});

// 🧩 Models
const StreamLog = mongoose.model('StreamLog', StreamSchema);
const DownloadLog = mongoose.model('DownloadLog', DownloadSchema);
const Video = mongoose.model('Video', VideoSchema);
const UsageModel = mongoose.model('Usage', UsageSchema);
const View = mongoose.model('View', ViewSchema);

// 💾 In-memory verification code store
const verificationCodes = {};

// 🌐 ROUTES

// 1️⃣ Default route
app.get('/', (req, res) => {
  res.send('📊 King Charmer Streaming Backend is live & connected!');
});

// 2️⃣ Streaming analytics summary
app.get('/api/analytics', async (req, res) => {
  try {
    const streamData = await StreamLog.aggregate([
      { $group: { _id: "$provider", totalSeconds: { $sum: "$seconds" }, count: { $sum: 1 } } }
    ]);

    const response = {};
    streamData.forEach(d => {
      const dataMB = d.totalSeconds * 1.8;
      const dataGB = dataMB / 1024;
      const hours = d.totalSeconds / 3600;
      response[d._id.toLowerCase()] = {
        users: d.count,
        hours: hours.toFixed(2),
        data: dataGB.toFixed(2)
      };
    });

    res.json(response);
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Failed to get analytics data" });
  }
});

// 3️⃣ Send verification email
app.post("/api/send-verification-email", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ success: false, message: "Email and code required" });

  try {
    verificationCodes[email] = { code, createdAt: Date.now() }; // store code with timestamp

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    await transporter.sendMail({
      from: `"King Charmer Network" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🔐 King Charmer Withdrawal Verification Code",
      html: `<div style="font-family: Poppins, sans-serif; background:#f9f9ff; padding:20px; border-radius:10px;">
        <h2 style="color:#00b7ff;">King Charmer Network Verification</h2>
        <p>Use the verification code below to confirm your withdrawal request:</p>
        <h1 style="letter-spacing:5px; background:#000; color:#00ffff; padding:10px 20px; border-radius:10px; display:inline-block;">
          ${code}
        </h1>
        <p>This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
        <p style="color:#666;">© 2025 King Charmer Network — Secure Analytics Division</p>
      </div>`,
    });

    res.json({ success: true, message: "✅ Verification email sent successfully!" });
  } catch (err) {
    console.error("❌ Verification email error:", err);
    res.status(500).json({ success: false, message: "Failed to send verification email." });
  }
});

// 4️⃣ Withdrawal email (only if code verified)
app.post("/api/send-withdraw-email", async (req, res) => {
  const { provider, accountNumber, accountName, bankName, amount, email, phone, companyEmail, currentBalance, code } = req.body;

  // verify code
  const record = verificationCodes[email];
  if (!record || record.code !== code || (Date.now() - record.createdAt) > 10 * 60 * 1000) {
    return res.status(400).json({ success: false, message: "❌ Invalid or expired verification code." });
  }

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
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    await transporter.sendMail({
      from: `"King Charmer Analytics" <${process.env.EMAIL_USER}>`,
      to: companyEmail,
      subject: `Withdrawal Request - ${provider} Network`,
      text: message,
    });

    delete verificationCodes[email]; // remove after successful use
    res.json({ success: true, message: "✅ Withdrawal email sent successfully!" });
  } catch (err) {
    console.error("❌ Email error:", err);
    res.status(500).json({ success: false, message: "Failed to send email." });
  }
});

// 5️⃣ Stream log route for all providers
app.post("/api/log-stream", async (req, res) => {
  const { videoId, seconds, provider } = req.body;
  if (!videoId || !seconds || !provider) return res.status(400).json({ error: "Missing parameters" });

  try {
    await StreamLog.create({ videoId, seconds, provider });
    res.json({ success: true, message: "Stream logged successfully!" });
  } catch (err) {
    console.error("❌ Stream logging error:", err);
    res.status(500).json({ error: "Failed to log stream" });
  }
});

// 6️⃣ Other existing routes (withdraw balance, summary)
app.get("/api/withdraw/:provider", async (req, res) => {
  try {
    const { provider } = req.params;
    const usageData = await UsageModel.findOne({ provider });
    res.json({ provider, balance: usageData ? usageData.earnings : 0 });
  } catch (err) {
    console.error("Balance fetch error:", err);
    res.status(500).json({ error: "Failed to load provider balance." });
  }
});

app.get("/api/summary", async (req, res) => {
  try {
    const totalViews = await View.countDocuments();
    const totalStreams = await StreamLog.countDocuments();
    const totalDownloads = await DownloadLog.countDocuments();
    res.json({ views: totalViews, streams: totalStreams, downloads: totalDownloads });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

// 🚀 START SERVER
const PORT = process.env.PORT || 12000;
app.listen(PORT, () => console.log(`🚀 King Charmer Analytics running on port ${PORT}`));