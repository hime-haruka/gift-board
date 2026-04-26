const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const configPath = path.join(__dirname, "config.json");
const examplePath = path.join(__dirname, "config.example.json");

if (!fs.existsSync(configPath)) {
  fs.copyFileSync(examplePath, configPath);
  console.log("config.json created. Edit serverUrl first, then run again.");
  process.exit(0);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const tikfinityWsUrl = config.tikfinityWsUrl || "ws://localhost:21213/";
const serverUrl = (config.serverUrl || "").replace(/\/$/, "");

if (!serverUrl || serverUrl.includes("YOUR-APP")) {
  console.error("Please edit local-receiver/config.json serverUrl.");
  process.exit(1);
}

function pick(...values) {
  return values.find((v) => v !== undefined && v !== null && v !== "");
}

function isRoomUserEvent(message) {
  return String(message.event || "").toLowerCase() === "roomuser";
}

function isEnterToast(message) {
  const data = message.data || {};
  return (
    String(data.displayType || "").includes("live_room_enter") ||
    String(data.label || "").includes("joined")
  );
}

function normalizeTikfinityMessage(message) {
  const eventName = String(
    pick(message.event, message.type, message.eventName, message.action, message.name, "")
  ).toLowerCase();

  const data = message.data || message.payload || message || {};
  const user = data.user || data.sender || data.viewer || data.owner || {};
  const gift = data.gift || data.giftInfo || {};
  const rawText = JSON.stringify(message).toLowerCase();

  if (isRoomUserEvent(message)) return null;

  if (eventName === "member" && isEnterToast(message)) return null;

  if (
    eventName.includes("gift") ||
    rawText.includes('"giftname"') ||
    rawText.includes('"giftid"') ||
    data.giftName ||
    data.giftId ||
    gift.name
  ) {
    const count = Number(pick(data.count, data.repeatCount, data.quantity, data.amount, gift.repeatCount, 1)) || 1;
    const diamond = Number(pick(data.diamondCount, data.diamond, data.value, data.coin, gift.diamondCount, gift.diamond, gift.value, 0)) || 0;

    return {
      type: "gift",
      nickname: pick(data.nickname, data.uniqueId, data.username, user.nickname, user.uniqueId, user.displayName),
      profileImage: pick(
        data.profileImage,
        data.profilePictureUrl,
        data.avatar,
        user.profilePictureUrl,
        user.avatar,
        user.profileImageUrl
      ),
      giftName: pick(data.giftName, data.name, gift.name, gift.giftName, "Gift"),
      giftImage: pick(
        data.giftImage,
        data.giftPictureUrl,
        data.image,
        data.icon,
        data.giftIcon,
        gift.image,
        gift.icon,
        gift.giftPictureUrl,
        gift.pictureUrl
      ),
      count,
      diamond,
      totalDiamond: count * diamond,
      raw: message
    };
  }

  const level = pick(data.level, data.newLevel, data.memberLevel, data.teamMemberLevel, user.memberLevel, user.teamMemberLevel);

  if (
    level &&
    (
      eventName.includes("member") ||
      eventName.includes("level") ||
      rawText.includes("memberlevel") ||
      rawText.includes("teammemberlevel")
    )
  ) {
    return {
      type: "member_level",
      nickname: pick(data.nickname, data.uniqueId, data.username, user.nickname, user.uniqueId, user.displayName),
      profileImage: pick(
        data.profileImage,
        data.profilePictureUrl,
        data.avatar,
        user.profilePictureUrl,
        user.avatar,
        user.profileImageUrl
      ),
      level,
      raw: message
    };
  }

  return null;
}

async function sendEvent(event) {
  const url = serverUrl.endsWith("/api/event") ? serverUrl : `${serverUrl}/api/event`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": config.adminToken || ""
    },
    body: JSON.stringify(event)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Server responded ${res.status}: ${text}`);
  }
}

function connect() {
  console.log(`Connecting to TikFinity: ${tikfinityWsUrl}`);
  const ws = new WebSocket(tikfinityWsUrl);

  ws.on("open", () => {
    console.log("Connected to TikFinity WebSocket.");
    console.log("Waiting for gift/member level events...");
  });

  ws.on("message", async (buffer) => {
    try {
      const text = buffer.toString();
      const message = JSON.parse(text);

      const event = normalizeTikfinityMessage(message);

      if (!event) {
        const name = message.event || message.type || "unknown";
        if (name !== "roomUser" && name !== "config") {
          console.log("Ignored event:", name);
        }
        return;
      }

      console.log("NORMALIZED EVENT:", {
        type: event.type,
        nickname: event.nickname,
        giftName: event.giftName,
        count: event.count,
        diamond: event.diamond,
        level: event.level
      });

      await sendEvent(event);

      console.log(
        "Forwarded:",
        event.type,
        event.nickname || "",
        event.giftName || "",
        event.count ? `x${event.count}` : "",
        event.level ? `Lv.${event.level}` : ""
      );
    } catch (err) {
      console.error("Event handling failed:", err.message);
    }
  });

  ws.on("close", () => {
    console.log("TikFinity WebSocket closed. Reconnecting in 3 seconds...");
    setTimeout(connect, 3000);
  });

  ws.on("error", (err) => {
    console.error("TikFinity WebSocket error:", err.message);
  });
}

connect();
