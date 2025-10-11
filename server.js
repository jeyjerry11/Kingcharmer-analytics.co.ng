// ===== analytics-server.js =====
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
  dataUsedMB: Number,
  earnedNGN: Number,
  timestamp: { type: Date, default: Date.now }
});

const DownloadSchema = new mongoose.Schema({
  videoId: String,
  size: Number,
  ngn: Number,
  provider: String,
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
  event: String,
  dataUsedMB: Number,
  earnedNGN: Number,
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
  res.send('📊 King Charmer Streaming Analytics Backend is live & connected!');
});

// 2️⃣ Track stream (frontend sends seconds, provider, dataUsedMB, earnedNGN)
app.post('/api/log-stream', async (req, res) => {
  try {
    const { videoId, seconds = 0, provider, dataUsedMB = 0, earnedNGN } = req.body;
    if (!videoId || !provider) return res.status(400).json({ error: "Missing parameters" });

    // Calculate earned if missing
    const COST_PER_SECOND = 10; // ₦10 per second
    const COST_PER_MB = 5;      // ₦5 per MB
    const finalEarned = earnedNGN || (seconds * COST_PER_SECOND + dataUsedMB * COST_PER_MB);

    await StreamLog.create({ videoId, seconds, provider, dataUsedMB, earnedNGN: finalEarned });

    // Update UsageModel for provider earnings
    await UsageModel.findOneAndUpdate(
      { provider },
      { $inc: { earnings: finalEarned } },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: "Stream logged", earnedNGN: finalEarned });
  } catch (err) {
    console.error("❌ Stream logging error:", err);
    res.status(500).json({ error: "Failed to log stream" });
  }
});

// 3️⃣ Track download
app.post('/api/log-download', async (req, res) => {
  try {
    const { videoId, size = 0, ngn = 0, provider } = req.body;
    if (!videoId) return res.status(400).json({ error: "Missing videoId" });

    await DownloadLog.create({ videoId, size, ngn, provider });
    res.json({ success: true, message: "Download logged" });
  } catch (err) {
    console.error("❌ Download logging error:", err);
    res.status(500).json({ error: "Failed to log download" });
  }
});

// 4️⃣ Log view analytics
app.post('/api/log-view', async (req, res) => {
  try {
    const { videoId, userId, provider, event, dataUsedMB = 0, earnedNGN = 0 } = req.body;
    if (!videoId || !provider) return res.status(400).json({ error: "Missing parameters" });

    await View.create({ videoId, userId, provider, event, dataUsedMB, earnedNGN });
    res.json({ success: true, message: "View logged" });
  } catch (err) {
    console.error("❌ View logging error:", err);
    res.status(500).json({ error: "Failed to log view" });
  }
});

// 5️⃣ Analytics summary for UI
app.get('/api/analytics-summary', async (req, res) => {
  try {
    const totalStreams = await StreamLog.countDocuments();
    const totalDownloads = await DownloadLog.countDocuments();
    const totalVideos = await Video.countDocuments();
    const totalViews = await View.countDocuments();

    // Earnings per provider
    const providerEarnings = await UsageModel.find();

    const providerStats = {};
    providerEarnings.forEach(p => {
      providerStats[p.provider] = p.earnings;
    });

    res.json({
      totalStreams,
      totalDownloads,
      totalVideos,
      totalViews,
      providerStats
    });
  } catch (err) {
    console.error("❌ Analytics summary error:", err);
    res.status(500).json({ error: "Failed to fetch analytics summary" });
  }
});

// 6️⃣ Fetch all videos
app.get('/api/videos', async (req, res) => {
  try {
    const videos = await Video.find().sort({ createdAt: -1 });
    res.json(videos);
  } catch (err) {
    console.error("❌ Fetch videos error:", err);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
});

// 7️⃣ Send verification email
app.post("/api/send-verification-email", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ success: false, message: "Email and code required" });

  try {
    verificationCodes[email] = { code, createdAt: Date.now() };

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    await transporter.sendMail({
      from: `"King Charmer Network" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🔐 King Charmer Withdrawal Verification Code",
      html: `<div style="font-family: Poppins, sans-serif; background:#f9f9ff; padding:20px; border-radius:10px;">
        <h2 style="color:#00b7ff;">Verification Code</h2>
        <h1 style="letter-spacing:5px; background:#000; color:#00ffff; padding:10px 20px; border-radius:10px; display:inline-block;">
          ${code}
        </h1>
        <p>Expires in 10 minutes.</p>
      </div>`,
    });

    res.json({ success: true, message: "Verification email sent" });
  } catch (err) {
    console.error("❌ Verification email error:", err);
    res.status(500).json({ success: false, message: "Failed to send email." });
  }
});

// 8️⃣ Send withdrawal request email
app.post("/api/send-withdraw-email", async (req, res) => {
  const { provider, accountNumber, accountName, bankName, amount, email, phone, companyEmail, currentBalance, code } = req.body;

  const record = verificationCodes[email];
  if (!record || record.code !== code || (Date.now() - record.createdAt) > 10 * 60 * 1000)
    return res.status(400).json({ success: false, message: "Invalid or expired verification code." });

  const message = `
💰 Withdrawal Request

Provider: ${provider}
Requested By: ${accountName}
Bank Name: ${bankName}
Account Number: ${accountNumber}
Phone: ${phone}
Email: ${email}
Amount: ₦${amount}
Current Balance: ₦${currentBalance}
`;

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    await transporter.sendMail({
      from: `"King Charmer Analytics" <${process.env.EMAIL_USER}>`,
      to: companyEmail,
      subject: `Withdrawal Request - ${provider}`,
      text: message,
    });

    delete verificationCodes[email];
    res.json({ success: true, message: "Withdrawal email sent successfully!" });
  } catch (err) {
    console.error("❌ Withdrawal email error:", err);
    res.status(500).json({ success: false, message: "Failed to send email." });
  }
});

// 9️⃣ Provider balance route
app.get("/api/withdraw/:provider", async (req, res) => {
  try {
    const { provider } = req.params;
    const usageData = await UsageModel.findOne({ provider });
    res.json({ provider, balance: usageData ? usageData.earnings : 0 });
  } catch (err) {
    console.error("❌ Balance fetch error:", err);
    res.status(500).json({ error: "Failed to load provider balance." });
  }
});

// 10️⃣ Summary route
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