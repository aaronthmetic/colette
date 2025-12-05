import { CommandInteraction, Client, ApplicationCommandType } from "discord.js";

async function run(_client, interaction) {
  const start = Date.now();
  await interaction.deferReply();
  const msDiff = Date.now() - start;
  const content = `Pong! ${msDiff}ms`;

  await interaction.followUp({
    ephemeral: true,
    content
  });
}

export const ping = {
  name: "ping",
  description: "pongs u back",
  type: ApplicationCommandType.ChatInput,
  run
};