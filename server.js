const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

// 테스트용
app.get("/", (req, res) => {
  res.send("Server is alive");
});

// overlay
app.get("/overlay", (req, res) => {
  res.sendFile(__dirname + "/overlay/index.html");
});

// admin
app.get("/admin", (req, res) => {
  res.sendFile(__dirname + "/admin/index.html");
});

// 이벤트 수신
app.post("/api/event", (req, res) => {
  console.log("EVENT:", req.body);
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
