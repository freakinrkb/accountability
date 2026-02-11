const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

/* ======================
   CORS (Production Safe)
====================== */
app.use(cors({
  origin: [
    "https://accountability-three.vercel.app", // your vercel URL
    "http://localhost:5173",
    "http://localhost:5174"
  ],
  methods: ["GET", "POST", "DELETE"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

/* ======================
   MongoDB Connection
====================== */

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 10000
})
.then(() => {
  console.log("✅ MongoDB Connected");
})
.catch((err) => {
  console.error("❌ MongoDB Connection Error:", err);
});

/* ======================
   Schemas
====================== */

const userSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  github: String,
  streak: { type: Number, default: 0 },
  cycleStart: Date
});

const goalSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  userName: String,
  text: String,
  completed: { type: Boolean, default: false },
  allocatedMinutes: Number,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);
const Goal = mongoose.model("Goal", goalSchema);

/* ======================
   Routes
====================== */

app.get("/", (req, res) => {
  res.send("Backend running");
});

/* LOGIN OR REGISTER */
app.post("/login", async (req, res) => {
  try {
    const { name, github } = req.body;

    const existingUser = await User.findOne({ name });

    if (existingUser) {
      return res.json(existingUser);
    }

    if (!github) {
      return res.status(404).json({
        message:
          "User not found. Enter correct name or provide GitHub to register."
      });
    }

    const newUser = await User.create({ name, github });
    res.json(newUser);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login error" });
  }
});

/* ADD GOAL */
app.post("/goal", async (req, res) => {
  try {
    const { userId, userName, text, allocatedMinutes } = req.body;

    const user = await User.findById(userId);

    if (!user.cycleStart) {
      user.cycleStart = new Date();
      await user.save();
    }

    const goal = await Goal.create({
      userId,
      userName,
      text,
      allocatedMinutes
    });

    res.json(goal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Add goal error" });
  }
});

/* GET GOALS (Last 3 Days) */
app.get("/goals", async (req, res) => {
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const goals = await Goal.find({
      createdAt: { $gte: threeDaysAgo }
    }).sort({ createdAt: -1 });

    res.json(goals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Fetch goals error" });
  }
});

/* TOGGLE GOAL */
app.post("/toggle", async (req, res) => {
  try {
    const { goalId } = req.body;

    const goal = await Goal.findById(goalId);
    goal.completed = !goal.completed;
    await goal.save();

    res.json(goal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Toggle error" });
  }
});

/* DELETE GOAL (30 min rule) */
app.delete("/goal/:id", async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);

    if (!goal) {
      return res.status(404).json({ message: "Goal not found" });
    }

    const now = new Date();
    const diffMinutes = (now - goal.createdAt) / (1000 * 60);

    if (diffMinutes > 30) {
      return res.status(403).json({
        message: "Delete window expired (30 minutes only)"
      });
    }

    await Goal.findByIdAndDelete(req.params.id);
    res.json({ message: "Goal deleted" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Delete error" });
  }
});

/* UPDATE STREAK */
app.post("/streak", async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);
    const goals = await Goal.find({ userId });

    const allCompleted =
      goals.length > 0 &&
      goals.every(goal => goal.completed);

    if (allCompleted) {
      user.streak += 1;
      user.cycleStart = null;
      await Goal.deleteMany({ userId });
      await user.save();
    }

    res.json(user);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Streak error" });
  }
});

/* LEADERBOARD */
app.get("/users", async (req, res) => {
  try {
    const users = await User.find().sort({ streak: -1 });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Users error" });
  }
});

/* ======================
   PORT (Render Required)
====================== */

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});