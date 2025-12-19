const axios = require("axios");

const fs = require("fs");

const path = require("path");

const request = require("request");


const nekosTypes = [

  "hug", "kiss", "neko", "fox_girl", "cuddle", "pat",

  "waifu", "smug", "woof", "lizard", "meow", "feed"

];


module.exports = {

  config: {

    name: "uptime",

    aliases: ["up", "upt"],

    version: "2.0.0",

    author: "Aminul Sardar",

    role: 0,

    shortDescription: {

      en: "Displays bot uptime with a random anime picture."

    },

    longDescription: {

      en: "Shows how long the bot has been running in days, hours, minutes, seconds, and sends a random anime image."

    },

    category: "system",

    guide: {

      en: "Use {p}uptime to view bot uptime with a random anime picture."

    }

  },


  onStart: async function ({ api, event }) {

    try {

      // 🕒 Calculate uptime

      const uptime = process.uptime();

      const days = Math.floor(uptime / 86400);

      const hours = Math.floor((uptime % 86400) / 3600);

      const minutes = Math.floor((uptime % 3600) / 60);

      const seconds = Math.floor(uptime % 60);

      const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;


      // 🎲 Choose a random nekos image type

      const randomType = nekosTypes[Math.floor(Math.random() * nekosTypes.length)];

      const apiUrl = `https://my-api-show.vercel.app/api/nekos?type=${randomType}`;

      const res = await axios.get(apiUrl);

      const imageUrl = res.data.url;


      // 🖼️ Save the image

      const ext = imageUrl.substring(imageUrl.lastIndexOf(".") + 1);

      const cacheDir = path.join(__dirname, "cache");

      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

      const filePath = path.join(cacheDir, `uptime_${Date.now()}.${ext}`);


      const caption = `

➽────────────────❥

🤖 𝗕𝗼𝘁 𝗨𝗽𝘁𝗶𝗺𝗲 𝗜𝗻𝗳𝗼𝗿𝗺𝗮𝘁𝗶𝗼𝗻 🤖


⏳ 𝗧𝗼𝘁𝗮𝗹 𝗧𝗶𝗺𝗲 𝗥𝘂𝗻𝗻𝗶𝗻𝗴:

💫 ${uptimeString}


🌸 𝗥𝗮𝗻𝗱𝗼𝗺 𝗔𝗻𝗶𝗺𝗲: ${randomType}

👑 𝗕𝗼𝘁 𝗕𝘆: @Aminusardar

🔗 facebook.com/100071880593545

🎯 𝗘𝗻𝗷𝗼𝘆 𝘂𝘀𝗶𝗻𝗴 𝘁𝗵𝗲 𝗯𝗼𝘁! 💖

➽────────────────❥

`;


      // 📤 Send with attachment

      const callback = () => {

        api.sendMessage(

          {

            body: caption,

            attachment: fs.createReadStream(filePath)

          },

          event.threadID,

          () => fs.unlinkSync(filePath)

        );

      };


      request(imageUrl)

        .pipe(fs.createWriteStream(filePath))

        .on("close", callback)

        .on("error", (err) => {

          console.error("❌ Error downloading image:", err);

          api.sendMessage(caption, event.threadID);

        });

    } catch (error) {

      console.error("⚠️ Uptime command error:", error);

      return api.sendMessage("⚠️ Failed to get uptime image, please try again later.", event.threadID);

    }

  }

};