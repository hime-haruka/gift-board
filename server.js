const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "2mb" }));

const state = {
  events: [],
  settings: {
    maxItems: 10,
    minDiamond: 0,
    showProfile: true,
    showDiamond: true,
    cardOpacity: 1,
    fontSize: 18
  }
};

function getValue(event) {
  return Number(event.totalDiamond ?? event.diamond ?? event.value ?? 0) || 0;
}

function normalizeIncomingEvent(body) {
  const type = body.type || body.event;

  if (type === "gift") {
    const count = Number(body.count || body.repeatCount || 1) || 1;
    const diamond = Number(body.diamond || body.diamondCount || body.value || 0) || 0;

    return {
      id: body.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: "gift",
      nickname: body.nickname || body.uniqueId || body.username || "익명",
      profileImage: body.profileImage || body.profilePictureUrl || "",
      giftName: body.giftName || body.name || "Gift",
      giftImage: body.giftImage || body.giftPictureUrl || body.giftIcon || body.image || "",
      count,
      diamond,
      totalDiamond: Number(body.totalDiamond || diamond * count) || 0,
      createdAt: Date.now(),
      raw: body.raw || body
    };
  }

  if (type === "member_level") {
    return {
      id: body.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: "member_level",
      nickname: body.nickname || body.uniqueId || body.username || "익명",
      profileImage: body.profileImage || body.profilePictureUrl || "",
      level: body.level || body.teamMemberLevel || body.memberLevel || "",
      createdAt: Date.now(),
      raw: body.raw || body
    };
  }

  return null;
}

function applyRules() {
  const minDiamond = Number(state.settings.minDiamond || 0);
  const maxItems = Number(state.settings.maxItems || 10);

  let filtered = state.events.filter((event) => {
    if (event.type !== "gift") return true;
    return getValue(event) >= minDiamond;
  });

  if (filtered.length > maxItems) {
    filtered = filtered
      .sort((a, b) => getValue(b) - getValue(a) || b.createdAt - a.createdAt)
      .slice(0, maxItems);
  }

  state.events = filtered.sort((a, b) => b.createdAt - a.createdAt);
}

function mergeGift(event) {
  const mergeWindowMs = 15000;

  const existing = state.events.find((item) => {
    if (item.type !== "gift") return false;
    if (item.nickname !== event.nickname) return false;
    if (item.giftName !== event.giftName) return false;
    return Date.now() - item.createdAt < mergeWindowMs;
  });

  if (!existing) return false;

  existing.count = Number(existing.count || 1) + Number(event.count || 1);
  existing.diamond = Number(event.diamond || existing.diamond || 0);
  existing.totalDiamond = Number(existing.diamond || 0) * Number(existing.count || 1);
  existing.giftImage = event.giftImage || existing.giftImage;
  existing.profileImage = event.profileImage || existing.profileImage;
  existing.createdAt = Date.now();
  existing.raw = event.raw || existing.raw;
  return true;
}

app.use("/admin", express.static(path.join(__dirname, "admin")));
app.use("/overlay", express.static(path.join(__dirname, "overlay")));

app.get("/", (req, res) => {
  res.send("Server is alive");
});

app.get("/api/state", (req, res) => {
  applyRules();
  res.json(state);
});

app.get("/api/events", (req, res) => {
  applyRules();
  res.json(state.events);
});

app.get("/api/settings", (req, res) => {
  res.json(state.settings);
});

app.post("/api/settings", (req, res) => {
  state.settings = {
    ...state.settings,
    ...req.body
  };
  applyRules();
  res.json({ ok: true, settings: state.settings });
});

app.post("/api/event", (req, res) => {
  const event = normalizeIncomingEvent(req.body);

  if (!event) {
    console.log("Ignored incoming event:", req.body?.type || req.body?.event || "unknown");
    return res.json({ ok: true, ignored: true });
  }

  if (event.type === "gift") {
    const merged = mergeGift(event);
    if (!merged) state.events.unshift(event);
  } else {
    state.events.unshift(event);
  }

  applyRules();

  console.log("EVENT:", {
    type: event.type,
    nickname: event.nickname,
    giftName: event.giftName,
    count: event.count,
    diamond: event.diamond,
    level: event.level
  });

  res.json({ ok: true, event });
});

app.post("/api/test/gift", (req, res) => {
  const event = normalizeIncomingEvent({
    type: "gift",
    nickname: "테스트유저",
    profileImage: "",
    giftName: "Donut",
    giftImage: "",
    count: 5,
    diamond: 100
  });

  state.events.unshift(event);
  applyRules();
  res.json({ ok: true, event });
});

app.post("/api/test/member-level", (req, res) => {
  const event = normalizeIncomingEvent({
    type: "member_level",
    nickname: "테스트유저",
    profileImage: "",
    level: 7
  });

  state.events.unshift(event);
  applyRules();
  res.json({ ok: true, event });
});

app.post("/api/clear", (req, res) => {
  state.events = [];
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
