import util from "node:util";
const pm2 = process.env.PM2_USAGE ? (await import("pm2")).default : null;
import { config } from "dotenv";
import db from "./database.js";
import { servers } from "./image.js";

// playing messages
import messagesConfig from "#config/messages.json" with { type: "json" };
import commandsConfig from "#config/commands.json" with { type: "json" };

let broadcast = false;

// random(array) to select a random entry in array
export function random(array) {
  if (!array || array.length < 1) return null;
  return array[Math.floor(Math.random() * array.length)];
}

const optionalReplace = (token) => {
  return token === undefined || token === "" ? "" : (token === "true" || token === "false" ? token : "<redacted>");
};

// clean(text) to clean message of any private info or mentions
export function clean(input) {
  let text = input;
  if (typeof text !== "string")
    text = util.inspect(text, { depth: 1 });

  text = text
    .replaceAll("`", `\`${String.fromCharCode(8203)}`)
    .replaceAll("@", `@${String.fromCharCode(8203)}`);

  let { parsed } = config();
  if (!parsed) parsed = process.env;

  if (servers?.length !== 0) {
    for (const { server, auth } of servers) {
      text = text.replaceAll(server, optionalReplace(server));
      text = text.replaceAll(auth, optionalReplace(auth));
    }
  }

  for (const env of Object.keys(parsed)) {
    text = text.replaceAll(parsed[env], optionalReplace(parsed[env]));
  }

  return text;
}

// textEncode(string) to encode characters for image processing
export function textEncode(string) {
  return string.replaceAll("&", "&amp;").replaceAll(">", "&gt;").replaceAll("<", "&lt;").replaceAll("\"", "&quot;").replaceAll("'", "&apos;").replaceAll("\\n", "\n").replaceAll("\\:", ":").replaceAll("\\,", ",");
}

// set activity (a.k.a. the gamer code)
export async function activityChanger(bot) {
  if (!broadcast) {
    await bot.editStatus("dnd", [{
      type: 0,
      name: random(messagesConfig.messages) + (commandsConfig.types.classic ? ` | @${bot.user.username} help` : "")
    }]);
  }
  setTimeout(() => activityChanger(bot), 900000);
}

export async function checkBroadcast(bot) {
  if (!db) {
    return;
  }
  const message = await db.getBroadcast();
  if (message) {
    startBroadcast(bot, message);
  }
}

export function startBroadcast(bot, message) {
  bot.editStatus("dnd", [{
    type: 0,
    name: message + (commandsConfig.types.classic ? ` | @${bot.user.username} help` : "")
  }]);
  broadcast = true;
}

export function endBroadcast(bot) {
  bot.editStatus("dnd", [{
    type: 0,
    name: random(messagesConfig.messages) + (commandsConfig.types.classic ? ` | @${bot.user.username} help` : "")
  }]);
  broadcast = false;
}

export function getServers(bot) {
  return new Promise((resolve, reject) => {
    if (pm2) {
      pm2.launchBus((_err, pm2Bus) => {
        const listener = (packet) => {
          if (packet.data?.type === "countResponse") {
            resolve(packet.data.serverCount);
            pm2Bus.off("process:msg");
          }
        };
        pm2Bus.on("process:msg", listener);

        pm2.list((err, list) => {
          if (err) {
            reject(err);
            return;
          }
          const managerProc = list.find((v) => v.name === "esmBot-manager");
          if (!managerProc) {
            pm2Bus.off("process:msg");
            return resolve(bot.guilds.size);
          }
          pm2.sendDataToProcessId(managerProc.pm_id, {
            id: managerProc.pm_id,
            type: "process:msg",
            data: {
              type: "getCount"
            },
            topic: true
          }, (err) => {
            if (err) reject(err);
          });
        });
      });
    } else {
      resolve(bot.guilds.size);
    }
  });
}

// copied from eris
/**
 * @param {import("oceanic.js").Message} message
 * @param {string} content
 */
export function cleanMessage(message, content) {
  let cleanContent = content?.replace(/<a?(:\w+:)[0-9]+>/g, "$1") || "";

  const author = message.author;
  let authorName = author.username;
  if (message.member?.nick) {
    authorName = message.member.nick;
  }
  cleanContent = cleanContent.replace(new RegExp(`<@!?${author.id}>`, "g"), `@${authorName}`);

  if (message.mentions) {
    for (const mention of message.mentions.members) {
      if (mention.nick) {
        cleanContent = cleanContent.replace(new RegExp(`<@!?${mention.id}>`, "g"), `@${mention.nick}`);
      }
      cleanContent = cleanContent.replace(new RegExp(`<@!?${mention.id}>`, "g"), `@${mention.username}`);
    }

    if (message.guildID && message.mentions.roles) {
      for (const roleID of message.mentions.roles) {
        const role = message.guild?.roles.get(roleID);
        const roleName = role ? role.name : "deleted-role";
        cleanContent = cleanContent.replace(new RegExp(`<@&${roleID}>`, "g"), `@${roleName}`);
      }
    }

    for (const id of message.mentions.channels) {
      const channel = message.client.getChannel(id);
      if (channel?.name && channel.mention) {
        cleanContent = cleanContent.replace(channel.mention, `#${channel.name}`);
      }
    }
  }

  return textEncode(cleanContent);
}

/**
 * @param {import("oceanic.js").CommandInteraction} interaction
 * @param {string} content
 */
export function cleanInteraction(interaction, content) {
  let cleanContent = content?.replace(/<a?(:\w+:)[0-9]+>/g, "$1") || "";

  const author = interaction.user;
  let authorName = author.username;
  if (interaction.member?.nick) {
    authorName = interaction.member.nick;
  }
  cleanContent = cleanContent.replace(new RegExp(`<@!?${author.id}>`, "g"), `@${authorName}`);

  for (const mention of interaction.data.resolved.members.values()) {
    if (mention.nick) {
      cleanContent = cleanContent.replace(new RegExp(`<@!?${mention.id}>`, "g"), `@${mention.nick}`);
    }
    cleanContent = cleanContent.replace(new RegExp(`<@!?${mention.id}>`, "g"), `@${mention.username}`);
  }

  if (interaction.guildID && interaction.data.resolved.roles.size > 0) {
    for (const role of interaction.data.resolved.roles.values()) {
      const roleName = role ? role.name : "deleted-role";
      cleanContent = cleanContent.replace(new RegExp(`<@&${role.id}>`, "g"), `@${roleName}`);
    }
  }

  for (const channel of interaction.data.resolved.channels.values()) {
    if (channel.name && channel.mention) {
      cleanContent = cleanContent.replace(channel.mention, `#${channel.name}`);
    }
  }

  return textEncode(cleanContent);
}

export function isEmpty(string) {
  return string.length === 0 || string.replace(/[\s\u2800\p{C}]/gu, "").length === 0;
}
