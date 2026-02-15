import "dotenv/config.js";
import discord from "discord.js";
const { Client, GatewayIntentBits, Interaction, MessageFlags } = discord;
import { commands } from "./commands/index.js";
import { getRostersFromCsv, sheetId, rosterGid } from "./helpers/rosters.js";
import { getAbbreviationsFromCsv, abbrGid } from "./helpers/abbreviations.js";
import { getMatchupsFromCsv, upperGid as upperMGid, lowerGid as lowerMGid } from "./helpers/matchups.js";
import { getStandingsFromCsv, upperGid as upperSGid, lowerGid as lowerSGid } from "./helpers/standings.js";
import { openMatches } from "./commands/match.js";
import { loadMatches } from "./helpers/matches.js";

const token = process.env.TOKEN;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.on("clientReady", async () => {
  if (!client.user || !client.application) {
    console.log("error logging in")
    return;
  }

  try {
    await loadMatches(openMatches);
    console.log(`Loaded ${openMatches.length} saved matches`);
  } catch (err) {
    console.error("Failed to load matches:", err);
  }

  // register commands
  await client.application.commands.set(commands);

  console.log(`${client.user.username} is online`);

  // warm cache
  try {
    await Promise.all([
      getRostersFromCsv(sheetId, rosterGid),
      getAbbreviationsFromCsv(sheetId, abbrGid),
      getMatchupsFromCsv(sheetId, lowerMGid),
      getMatchupsFromCsv(sheetId, upperMGid),
      getStandingsFromCsv(sheetId, lowerSGid),
      getStandingsFromCsv(sheetId, upperSGid)
    ]);

    console.log("Cache warmed");
  } catch (err) {
    console.error("Cache warm failed:", err);
  }
});

// Respond to commands
client.on("interactionCreate", async (interaction) => {
  if (interaction.isAutocomplete()) {
    const slashCommand = commands.find(c => c.name === interaction.commandName);
    if (!slashCommand) return;

    await slashCommand.run(client, interaction);
    return;
  }

  if (interaction.isButton()) {
    if (
      interaction.customId.startsWith("confirm_roster_") ||
      interaction.customId.startsWith("cancel_roster_")
    ) {
      const command = commands.find(c => c.name === "match");
      if (!command) return;

      await command.run(client, interaction);
      return;
    }
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