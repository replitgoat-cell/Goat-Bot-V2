const fs = require("fs-extra");
const axios = require("axios");
const request = require("request");
const path = require("path");

module.exports = {
  config: {
    name: "autolink",
    version: "1.2",
    author: "Aminul Sordar",
    countDown: 5,
    role: 0,
    shortDescription: "Auto download video from any link",
    category: "media"
  },

  onStart: async function () {},

  onChat: async function ({ api, event }) {
    try {
      const { threadID, messageID, body } = event;
      if (!body) return;

      // link detect
      const match = body.match(/https?:\/\/[^\s]+/);
      if (!match) return;

      const url = match[0];
      api.setMessageReaction("⏳", messageID, () => {}, true);

      const apiURL = `https://aminul-rest-api-three.vercel.app/downloader/alldownloader?url=${encodeURIComponent(url)}`;
      const res = await axios.get(apiURL);

      // 🔥 correct path
      const data = res?.data?.data?.data;
      if (!data) {
        return api.sendMessage(
          "❌ Video data পাওয়া যায়নি।",
          threadID,
          messageID
        );
      }

      const { title, high, low } = data;
      const videoURL = high || low;

      if (!videoURL) {
        return api.sendMessage(
          "❌ Download link পাওয়া যায়নি।",
          threadID,
          messageID
        );
      }

      const filePath = path.join(
        __dirname,
        "cache",
        `autolink_${Date.now()}.mp4`
      );
      await fs.ensureDir(path.dirname(filePath));

      request(videoURL)
        .pipe(fs.createWriteStream(filePath))
        .on("close", () => {
          api.sendMessage(
            {
              body: `🎬 𝗧𝗜𝗧𝗟𝗘:\n${title || "Unknown"}`,
              attachment: fs.createReadStream(filePath)
            },
            threadID,
            () => fs.unlinkSync(filePath),
            messageID
          );
        });

    } catch (err) {
      console.error("[AUTOLINK ERROR]", err);
      api.sendMessage(
        "❌ Video download করতে সমস্যা হয়েছে।",
        event.threadID,
        event.messageID
      );
    }
  }
};