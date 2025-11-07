const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "yt",
    aliases: ["youtube", "yts"],
    version: "3.7",
    author: "Aminul Sordar (Modified by Gemini)",
    role: 0,
    category: "media",
    shortDescription: "Search and download YouTube videos",
    longDescription: "Search YouTube and download videos in preferred quality using Aminul API.",
    guide: {
      en: "{pn} [search term] | [quality (optional)]",
      bn: "{pn} [সার্চ শব্দ] | [কোয়ালিটি (ঐচ্ছিক)]"
    }
  },

  onStart: async function ({ api, event, args }) {
    let query = args.join(" ");
    let preferredQuality = "360p";
    
    // Parse quality preference if provided (format: "query | 720p")
    if (query.includes("|")) {
      const parts = query.split("|").map(part => part.trim());
      query = parts[0];
      if (parts[1]) {
        preferredQuality = parts[1].toLowerCase();
      }
    }
    
    if (!query) {
      return api.sendMessage(
        "❌ **Error:** Please provide a search term to find a video.\n\n" +
        "**Examples:**\n" +
        "• `yt ami to valo nei`\n" +
        "• `yt tutorial | 720p`\n" +
        "• `yt music video | 480p`",
        event.threadID, event.messageID
      );
    }

    try {
      api.setMessageReaction("🔎", event.messageID, () => {}, true);
      const searchingMsg = await api.sendMessage(
        `✨ **Searching YouTube for:** "${query}"\n⏳ Please wait...`, 
        event.threadID, event.messageID
      );

      const url = `https://aminul-youtube-downloader.vercel.app/search?query=${encodeURIComponent(query)}`;
      const res = await axios.get(url, { timeout: 10000 });
      const data = res.data;

      if (!data || data.length === 0) {
        await api.editMessage(
          "😔 **No Results Found!** I couldn't find any videos matching your query.", 
          searchingMsg.messageID
        );
        return;
      }

      const videos = data.slice(0, 6);
      
      // Download thumbnails and prepare attachments
      const attachments = [];
      const tmpDir = path.join(__dirname, "cache");
      await fs.ensureDir(tmpDir);

      for (let i = 0; i < videos.length; i++) {
        try {
          const imageUrl = videos[i].thumbnail || videos[i].image;
          if (imageUrl) {
            const imagePath = path.join(tmpDir, `thumbnail_${i}_${Date.now()}.jpg`);
            const imageResponse = await axios({
              method: 'GET',
              url: imageUrl,
              responseType: 'stream',
              timeout: 10000
            });
            
            const writer = fs.createWriteStream(imagePath);
            imageResponse.data.pipe(writer);
            
            await new Promise((resolve, reject) => {
              writer.on("finish", resolve);
              writer.on("error", reject);
            });
            
            attachments.push(fs.createReadStream(imagePath));
          }
        } catch (imageErr) {
          console.error(`Error downloading thumbnail ${i}:`, imageErr);
          // Continue even if one thumbnail fails
        }
      }

      // Create message with thumbnails
      let msg = `🎬 **Top YouTube Results** for: **"${query}"**\n`;
      msg += `📺 **Preferred Quality:** ${preferredQuality}\n\n`;
      msg += "━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

      videos.forEach((v, i) => {
        msg += `🎯 **${i + 1}. ${v.title}**\n`;
        msg += `   👤 **Channel:** ${v.author?.name || "Unknown"}\n`;
        msg += `   ⏱ **Duration:** ${v.duration?.timestamp || "N/A"}\n`;
        msg += `   👁 **Views:** ${v.views?.toLocaleString() || "N/A"}\n`;
        msg += `   📅 **Uploaded:** ${v.ago || "N/A"}\n`;
        msg += "━━━━━━━━━━━━━━━━━━━━━━━━\n";
      });

      msg += `\n**👇 Action Required:**\n`;
      msg += `   Reply with number (**1-${videos.length}**) to download\n`;
      msg += `   💡 *Trying to get ${preferredQuality} quality*\n`;
      msg += `⚡ *Powered by Aminul API*`;

      // Send message with attachments
      await api.sendMessage({
        body: msg,
        attachment: attachments
      }, event.threadID, async (err, info) => {
        if (err) {
          console.error("Error sending results with thumbnails:", err);
          // Fallback: send without thumbnails
          await api.sendMessage(msg, event.threadID);
        }
        
        // Clean up thumbnail files after sending
        setTimeout(async () => {
          try {
            const files = await fs.readdir(tmpDir);
            for (const file of files) {
              if (file.includes('thumbnail_')) {
                await fs.unlink(path.join(tmpDir, file));
              }
            }
          } catch (cleanupErr) {
            console.error("Thumbnail cleanup error:", cleanupErr);
          }
        }, 5000);

        if (!err) {
          global.GoatBot.onReply.set(info.messageID, {
            commandName: "yt",
            messageID: info.messageID,
            author: event.senderID,
            videos,
            preferredQuality
          });
        }
      });

      // Delete the initial searching message
      await api.unsendMessage(searchingMsg.messageID);

    } catch (err) {
      console.error("Search error:", err);
      api.sendMessage(
        "⚠️ **API Error:** Failed to connect to YouTube search service.\n" +
        "Please try again in a few moments.", 
        event.threadID, event.messageID
      );
    }
  },

  onReply: async function({ api, event, Reply }) {
    if (event.senderID !== Reply.author) {
      return api.sendMessage(
        "🚫 **Not for you!** This download request was initiated by another user.", 
        event.threadID, event.messageID
      );
    }

    const choice = parseInt(event.body.trim());
    if (isNaN(choice) || choice < 1 || choice > Reply.videos.length) {
      return api.sendMessage(
        `🧐 **Invalid Selection:** Please reply with a number between 1 and ${Reply.videos.length}.`, 
        event.threadID, event.messageID
      );
    }

    const video = Reply.videos[choice - 1];
    const tmpDir = path.join(__dirname, "cache");
    let videoPath = "";

    try {
      await fs.ensureDir(tmpDir);
    } catch (dirErr) {
      console.error("Cache directory error:", dirErr);
      return api.sendMessage(
        "❌ System error: Could not prepare cache directory!", 
        event.threadID, event.messageID
      );
    }

    const safeTitle = video.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    videoPath = path.join(tmpDir, `${Date.now()}_${safeTitle}.mp4`);

    try {
      api.setMessageReaction("⏳", event.messageID, () => {}, true);
      
      const resolvingMsg = await api.sendMessage(
        `🔗 **Step 1/3: Resolving Link**\n` +
        `**Title:** ${video.title}\n` +
        `**Preferred Quality:** ${Reply.preferredQuality}`,
        event.threadID
      );

      // Get available download links
      const downloadAPI = `https://aminul-youtube-downloader.vercel.app/api/ytdl?url=${encodeURIComponent(video.url)}`;
      const qualityRes = await axios.get(downloadAPI, { timeout: 15000 });
      
      if (!qualityRes.data.result || !qualityRes.data.data || qualityRes.data.data.length === 0) {
        await api.editMessage(
          "❌ **Download Error:** No streaming or download links found for this video!", 
          resolvingMsg.messageID
        );
        return;
      }

      const qualities = qualityRes.data.data;
      
      // Enhanced quality selection logic
      const findQuality = (pref) => {
        const prefLower = pref.toLowerCase();
        return qualities.find(q => 
          q.quality && q.quality.toLowerCase().includes(prefLower)
        );
      };

      // Try preferred quality first, then fallbacks
      let selectedQuality = findQuality(Reply.preferredQuality) || 
                           findQuality('360p') || 
                           findQuality('480p') ||
                           findQuality('720p') ||
                           qualities.find(q => q.quality && !q.quality.toLowerCase().includes('audio'));

      if (!selectedQuality) {
        await api.editMessage(
          "❌ **Download Error:** Could not find any suitable video stream.", 
          resolvingMsg.messageID
        );
        return;
      }

      // Update message with quality info
      let qualityMsg = `🎯 **Quality Selected:** **${selectedQuality.quality}**`;
      if (selectedQuality.quality !== Reply.preferredQuality) {
        qualityMsg += `\n⚠️ *Note: ${Reply.preferredQuality} was unavailable, using ${selectedQuality.quality} instead.*`;
      }

      await api.editMessage(
        `📥 **Step 2/3: Starting Download...**\n` +
        `${qualityMsg}\n` +
        `💾 **Estimated Size:** ${selectedQuality.size || 'Unknown'}`,
        resolvingMsg.messageID
      );

      // Download with better error handling
      const downloadRes = await axios({
        method: 'GET',
        url: selectedQuality.url,
        responseType: 'stream',
        timeout: 300000, // 5 minutes
        maxContentLength: 150 * 1024 * 1024, // 150MB max
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*'
        }
      });

      const writer = fs.createWriteStream(videoPath);
      let downloadedBytes = 0;
      const totalBytes = parseInt(downloadRes.headers['content-length']) || 0;

      // Add download progress tracking
      downloadRes.data.on('data', (chunk) => {
        downloadedBytes += chunk.length;
      });

      downloadRes.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
        downloadRes.data.on("error", reject);
      });

      // Verify download
      if (!(await fs.pathExists(videoPath))) {
        throw new Error("Download failed - file not created");
      }

      const stats = await fs.stat(videoPath);
      const fileSize = stats.size;

      if (fileSize < 1024) {
        await fs.unlink(videoPath);
        throw new Error("Downloaded file is too small or corrupted");
      }

      // Send success message with video
      const successMsg = `🎉 **Step 3/3: Download Complete!**\n\n` +
        `**🎬 Title:** ${video.title}\n` +
        `**🎯 Quality:** ${selectedQuality.quality}\n` +
        `**📊 Actual Size:** ${(fileSize / (1024 * 1024)).toFixed(1)}MB\n\n` +
        `*Enjoy the video! The temporary file will be cleaned up shortly.*`;
      
      await api.sendMessage({
        body: successMsg,
        attachment: fs.createReadStream(videoPath)
      }, event.threadID, event.messageID);
      
      api.setMessageReaction("✅", event.messageID, () => {}, true);

      // Clean up temporary files
      setTimeout(async () => {
        try {
          if (await fs.pathExists(videoPath)) {
            await fs.unlink(videoPath);
          }
          // Clean any remaining thumbnail files
          const files = await fs.readdir(tmpDir);
          for (const file of files) {
            if (file.includes('thumbnail_') || file.includes('.mp4')) {
              await fs.unlink(path.join(tmpDir, file));
            }
          }
        } catch (cleanupErr) {
          console.error("Cleanup error:", cleanupErr);
        }
      }, 10000);

    } catch (err) {
      console.error("Download error:", err);
      
      // Clean up on error
      if (videoPath && await fs.pathExists(videoPath)) {
        try {
          await fs.unlink(videoPath);
        } catch (cleanupErr) {
          console.error("Cleanup error during failed download:", cleanupErr);
        }
      }

      let errorMessage = "❌ **Download Failed!** A network or API error occurred. Please try a different video or try again later.";
      
      if (err.code === 'ECONNABORTED') {
        errorMessage = "❌ **Download Timeout!** The video file is likely too large or the connection was too slow. Try a shorter video.";
      } else if (err.response?.status === 404) {
        errorMessage = "❌ **Link Expired!** The temporary download link was not found. Please try the search again.";
      } else if (err.message?.includes('too small')) {
        errorMessage = "❌ **Corrupted File!** The downloaded file appears to be corrupted or invalid.";
      }
      
      api.sendMessage(errorMessage, event.threadID, event.messageID);
      api.setMessageReaction("❌", event.messageID, () => {}, true);
    }
  }
};
