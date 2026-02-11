const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

// ===== CORS =====
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://accountability-three.vercel.app"
  ],
  methods: ["GET", "POST", "DELETE"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

// ===== MongoDB =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// ===== Schemas =====
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

// ===== Routes =====

// Health
app.get("/", (req, res) => {
  res.send("Backend running");
});

// LOGIN OR REGISTER
app.post("/login", async (req, res) => {
  const { name, github } = req.body;

  const existingUser = await User.findOne({ name });

  // If user exists → login
  if (existingUser) {
    return res.json(existingUser);
  }

  // If user not found and no github provided
  if (!github) {
    return res.status(404).json({
      message:
        "User not found. Enter correct name or provide GitHub to register."
    });
  }

  // Create new user
  const newUser = await User.create({
    name,
    github
  });

  res.json(newUser);
});

// Add Goal
app.post("/goal", async (req, res) => {
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
});

// Get last 3 days goals
app.get("/goals", async (req, res) => {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const goals = await Goal.find({
    createdAt: { $gte: threeDaysAgo }
  }).sort({ createdAt: -1 });

  res.json(goals);
});

// Toggle goal
app.post("/toggle", async (req, res) => {
  const { goalId } = req.body;

  const goal = await Goal.findById(goalId);
  goal.completed = !goal.completed;
  await goal.save();

  res.json(goal);
});

// Delete goal (30 min rule)
app.delete("/goal/:id", async (req, res) => {
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
});

// Update streak
app.post("/streak", async (req, res) => {
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
});

// Leaderboard
app.get("/users", async (req, res) => {
  const users = await User.find().sort({ streak: -1 });
  res.json(users);
});

app.listen(8000, () => console.log("Server running on port 8000"));