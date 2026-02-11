import { useState, useEffect } from "react";
import axios from "axios";

const API = "https://your-render-url.onrender.com";
function App() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [github, setGithub] = useState("");
  const [goals, setGoals] = useState([]);
  const [input, setInput] = useState("");
  const [allocatedTime, setAllocatedTime] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [timeLeft, setTimeLeft] = useState("");

  // Persistent login
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  const fetchGoals = async () => {
    const res = await axios.get(`${API}/goals`);
    setGoals(res.data);
  };

  const fetchUsers = async () => {
    const res = await axios.get(`${API}/users`);
    setAllUsers(res.data);
  };

  useEffect(() => {
    if (!user) return;
    fetchGoals();
    fetchUsers();
  }, [user]);

  // 24h timer
  useEffect(() => {
    if (!user?.cycleStart) {
      setTimeLeft("");
      return;
    }

    const interval = setInterval(() => {
      const start = new Date(user.cycleStart);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      const diff = end - new Date();

      if (diff <= 0) {
        setTimeLeft("Cycle ended");
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);

      setTimeLeft(`${h}h ${m}m ${s}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [user?.cycleStart]);

  // LOGIN (name-only if exists)
  const login = async () => {
    if (!name) {
      alert("Enter your name");
      return;
    }

    try {
      const res = await axios.post(`${API}/login`, { name });

      setUser(res.data);
      localStorage.setItem("user", JSON.stringify(res.data));
    } catch (err) {
      if (err.response?.status === 404) {
        if (!github) {
          alert(
            "You are not in database. Enter correct name or provide GitHub to register."
          );
          return;
        }

        try {
          const username = github.split("github.com/")[1];
          const response = await fetch(
            `https://api.github.com/users/${username}`
          );

          if (!response.ok) {
            alert("GitHub user not found");
            return;
          }

          const registerRes = await axios.post(`${API}/login`, {
            name,
            github
          });

          setUser(registerRes.data);
          localStorage.setItem("user", JSON.stringify(registerRes.data));
        } catch {
          alert("GitHub validation failed");
        }
      }
    }
  };

  const addGoal = async () => {
    if (!input || !allocatedTime) return;

    await axios.post(`${API}/goal`, {
      userId: user._id,
      userName: user.name,
      text: input,
      allocatedMinutes: parseInt(allocatedTime)
    });

    const updatedUser = await axios.post(`${API}/login`, {
      name: user.name
    });

    setUser(updatedUser.data);
    localStorage.setItem("user", JSON.stringify(updatedUser.data));

    setInput("");
    setAllocatedTime("");

    fetchGoals();
    fetchUsers();
  };

  const toggle = async (id) => {
    await axios.post(`${API}/toggle`, { goalId: id });
    await axios.post(`${API}/streak`, { userId: user._id });

    const updatedUser = await axios.post(`${API}/login`, {
      name: user.name
    });

    setUser(updatedUser.data);
    localStorage.setItem("user", JSON.stringify(updatedUser.data));

    fetchGoals();
    fetchUsers();
  };

  const deleteGoal = async (id) => {
    try {
      await axios.delete(`${API}/goal/${id}`);
      fetchGoals();
    } catch (err) {
      alert(err.response?.data?.message || "Cannot delete goal");
    }
  };

  const logout = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="bg-slate-800 p-8 rounded-2xl w-96">
          <h1 className="text-2xl text-white mb-6 text-center">
            🔥 24H Accountability
          </h1>

          <input
            className="w-full p-3 mb-3 rounded bg-slate-700 text-white"
            placeholder="Your Name"
            onChange={(e) => setName(e.target.value)}
          />

          <input
            className="w-full p-3 mb-4 rounded bg-slate-700 text-white"
            placeholder="GitHub (only if new user)"
            onChange={(e) => setGithub(e.target.value)}
          />

          <button
            onClick={login}
            className="w-full bg-blue-600 p-3 rounded"
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-6xl mx-auto">

        <div className="flex justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">🔥 24H Accountability</h1>
            {timeLeft && <p className="text-orange-400">{timeLeft}</p>}
          </div>

          <div className="text-right">
            <p>{user.name}</p>
            <p className="text-sm text-slate-400">{user.github}</p>
            <p>🔥 {user.streak}</p>
            <button
              onClick={logout}
              className="mt-2 bg-red-600 px-3 py-1 rounded"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">

          <div className="col-span-2 bg-slate-800 p-6 rounded-2xl">
            <h2 className="text-xl mb-4">Your Goals</h2>

            <div className="flex gap-3 mb-6">
              <input
                className="flex-1 p-3 rounded bg-slate-700"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Goal..."
              />

              <input
                type="number"
                className="w-28 p-3 rounded bg-slate-700"
                value={allocatedTime}
                onChange={(e) => setAllocatedTime(e.target.value)}
                placeholder="Minutes"
              />

              <button
                onClick={addGoal}
                className="bg-green-600 px-5 rounded"
              >
                Add
              </button>
            </div>

            {goals
              .filter(g => g.userId === user._id)
              .map(goal => (
                <div
                  key={goal._id}
                  className={`p-4 mb-3 rounded flex justify-between ${
                    goal.completed ? "bg-green-700/40" : "bg-slate-700"
                  }`}
                >
                  <div>
                    <p>{goal.text}</p>
                    <p className="text-sm text-slate-400">
                      {goal.allocatedMinutes} mins • {new Date(goal.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => toggle(goal._id)}
                      className="bg-blue-600 px-3 rounded"
                    >
                      ✓
                    </button>

                    <button
                      onClick={() => deleteGoal(goal._id)}
                      className="bg-red-600 px-3 rounded"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
          </div>

          <div className="bg-slate-800 p-6 rounded-2xl">
            <h2 className="text-xl mb-4">🏆 Leaderboard</h2>
            {allUsers.map((u, i) => (
              <div key={u._id} className="flex justify-between bg-slate-700 p-3 rounded mb-2">
                <span>{i + 1}. {u.name}</span>
                <span>🔥 {u.streak}</span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;