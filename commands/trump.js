const gm = require("gm").subClass({
  imageMagick: true
});
const gmToBuffer = require("../utils/gmbuffer.js");

exports.run = async (message) => {
  message.channel.sendTyping();
  const image = await require("../utils/imagedetect.js")(message);
  if (image === undefined) return `${message.author.mention}, you need to provide an image to make a Trump meme!`;
  const template = "./assets/images/trump.png";
  const command = gm(template).background("white").out("null:").out("(").out(image.path).coalesce().out("-virtual-pixel", "transparent").resize("365x179!").out("+distort", "Perspective", "0,0 207,268 365,0 548,271 365,179 558,450 0,179 193,450").out(")").compose("over").gravity("Center").geometry("-217-135").out("-layers", "composite");
  const buffer = await gmToBuffer(command, image.outputType);
  return message.channel.createMessage("", {
    file: buffer,
    name: `trump.${image.outputType}`
  });
};

exports.category = 5;
exports.help = "Makes Trump display an image";