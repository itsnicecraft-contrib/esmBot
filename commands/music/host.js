import { players } from "#utils/soundplayer.js";
import logger from "#utils/logger.js";
import MusicCommand from "#cmd-classes/musicCommand.js";
import { Constants } from "oceanic.js";

class HostCommand extends MusicCommand {
  async run() {
    this.success = false;
    if (!this.guild) return this.getString("guildOnly");
    if (!this.member?.voiceState) return this.getString("sound.noVoiceState");
    if (!this.guild.voiceStates.get(this.client.user.id)?.channelID) return this.getString("sound.notInVoice");
    if (!this.connection) return this.getString("sound.noConnection");
    if (this.connection.host !== this.author.id && !process.env.OWNER.split(",").includes(this.connection.host)) return this.getString("commands.responses.host.notHost");
    const input = this.options.user ?? this.args.join(" ");
    if (input?.trim()) {
      let user;
      if (this.type === "classic" && this.message) {
        const getUser = this.message.mentions.users.length >= 1 ? this.message.mentions.users[0] : this.client.users.get(input);
        if (getUser) {
          user = getUser;
        } else if (input.match(/^<?[@#]?[&!]?\d+>?$/) && input >= 21154535154122752n) {
          try {
            user = await this.client.rest.users.get(input);
          } catch {
            // no-op
          }
        } else {
          const userRegex = new RegExp(input.split(" ").join("|"), "i");
          const member = this.client.users.find(element => {
            return userRegex.test(element.username);
          });
          user = member;
        }
      } else {
        user = this.client.users.get(input);
      }
      if (!user) return this.getString("commands.responses.host.noUser");
      if (user.bot) return "https://www.youtube.com/watch?v=rmQFcVR6vEs";
      const member = this.guild.members.get(user.id) ?? await this.client.rest.guilds.getMember(this.guild.id, user.id).catch(e => {
        logger.warn(`Failed to get a member: ${e}`);
      });
      if (!member) return this.getString("commands.responses.host.notMember");
      const object = this.connection;
      object.host = member.id;
      players.set(this.guild.id, object);
      this.success = true;
      return `🔊 ${this.getString("sound.newHost", { params: { member: member.mention } })}`;
    }
    const member = this.guild.members.get(players.get(this.guild.id).host);
    this.success = true;
    return `🔊 ${this.getString("commands.responses.host.currentHost", { params: { member: member?.username } })}`;
  }

  static flags = [{
    name: "user",
    type: Constants.ApplicationCommandOptionTypes.USER,
    description: "The user you want the new host to be",
    classic: true
  }];
  static description = "Gets or changes the host of the current voice session";
  static aliases = ["sethost"];
}

export default HostCommand;
