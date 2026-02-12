import "dotenv/config.js";
import discord from "discord.js";
const { Client, GatewayIntentBits, Interaction, MessageFlags } = discord;
import { commands } from "./commands/index.js";
import { openMatches } from "./commands/match.js";

const token = process.env.TOKEN;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.on("clientReady", async () => {
  if (!client.user || !client.application) {
    console.log("error logging in")
    return;
  }

  // register commands
  await client.application.commands.set(commands);

  console.log(`${client.user.username} is online`);
});

// Respond to commands
client.on("interactionCreate", async (interaction) => {
  if (interaction.isAutocomplete()) {
    const slashCommand = commands.find(c => c.name === interaction.commandName);
    if (!slashCommand) return;

    await slashCommand.run(client, interaction);
    return;
  }

  if (interaction.isChatInputCommand()) {
    const slashCommand = commands.find(c => c.name === interaction.commandName);
    if (!slashCommand) {
      await interaction.reply({ content: "An error has occurred" });
      return;
    }

    await slashCommand.run(client, interaction);
  }
});

client.login(token);