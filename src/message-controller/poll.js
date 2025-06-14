// poll.js

const pollMap = {}; // userId => pollData

function startPoll(userId, question, options) {
  pollMap[userId] = {
    question,
    voters: [],
    options: {}
  };

  options.forEach((opt, index) => {
    pollMap[userId].options[(index + 1).toString()] = { name: opt, votes: 0 };
  });
}

async function sendPollMessage(sock, jid, userId) {
  const pollData = pollMap[userId];
  if (!pollData) return;

  let message = `📊 Poll: ${pollData.question}\n\n`;
  for (const [key, data] of Object.entries(pollData.options)) {
    message += `${numberToEmoji(key)} - ${data.name}\n`;
  }
  message += `\nReply with the number (1, 2, etc.) to vote!`;
  await sock.sendMessage(jid, { text: message });
}

async function handlePollVote(message, sock) {
  const sender = message.key.participant || message.key.remoteJid;
  const vote = message.message?.conversation?.trim() || message.message?.extendedTextMessage?.text?.trim();
  const userId = message.userId; // Pass this manually from msgHandler

  const pollData = pollMap[userId];
  if (!pollData || !pollData.options[vote]) return;

  if (pollData.voters.includes(sender)) {
    await sock.sendMessage(message.key.remoteJid, { text: "❗You have already voted!" }, { quoted: message });
  } else {
    pollData.options[vote].votes += 1;
    pollData.voters.push(sender);

    let results = '';
    for (const [key, data] of Object.entries(pollData.options)) {
      results += `${numberToEmoji(key)} ${data.name}: ${data.votes} vote(s)\n`;
    }

    await sock.sendMessage(message.key.remoteJid, {
      text: `✅ Vote counted for *${pollData.options[vote].name}*!\n\n📊 *Current Results:*\n${results}`
    });
  }
}

function numberToEmoji(numStr) {
  const emojis = {
    "1": "1️⃣", "2": "2️⃣", "3": "3️⃣", "4": "4️⃣", "5": "5️⃣",
    "6": "6️⃣", "7": "7️⃣", "8": "8️⃣", "9": "9️⃣", "10": "🔟"
  };
  return emojis[numStr] || numStr;
}

function endPoll(userId) {
  const pollData = pollMap[userId];
  if (!pollData) return null;

  let results = `📊 *Poll Ended: ${pollData.question}*\n\n`;
  for (const [key, data] of Object.entries(pollData.options)) {
    results += `${numberToEmoji(key)} ${data.name}: ${data.votes} vote(s)\n`;
  }

  delete pollMap[userId];
  return results;
}

module.exports = {
  startPoll,
  sendPollMessage,
  handlePollVote,
  endPoll,
};
