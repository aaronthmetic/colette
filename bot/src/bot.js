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
  if (interaction.isCommand()) {
    const slashCommand = commands.find(c => c.name === interaction.commandName);
    if (!slashCommand) {
      interaction.reply({ content: "An error has occurred" });
      return;
    }
    // await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await slashCommand.run(client, interaction);
  }

  if (!interaction.isAutocomplete()) return;

  if (
    interaction.commandName === "match" &&
    interaction.options.getSubcommand() === "ban"
  ) {
    const match = openMatches.find(m =>
      m.channel === interaction.channelId &&
      m.captains.includes(interaction.user.id)
    );

    if (!match || match.phase !== "ban") {
      return interaction.respond([]);
    }

    const opponentId = match.captains.find(id => id !== interaction.user.id);
    const opponentRoster = match.rosters[opponentId] ?? [];

    const bannedPlayers = Object.values(match.bans.rounds)
      .flat()
      .map(b => b.player);

    const available = opponentRoster
      .filter(p => !bannedPlayers.includes(p))
      .map(p => ({ name: p, value: p }));

    await interaction.respond(available);
  }

  if (
    interaction.commandName === "match" &&
    interaction.options.getSubcommand() === "blindpick"
  ) {
    const match = openMatches.find(m =>
      m.channel === interaction.channelId &&
      m.captains.includes(interaction.user.id)
    );

    if (!match || match.phase !== "blindpick") {
      return interaction.respond([]);
    }

    const myRoster = match.rosters[interaction.user.id] ?? [];

    const bannedPlayers = Object.values(match.bans.rounds)
      .flat()
      .map(b => b.player);

    const alreadyPicked = match.blindPicks.map(p => p.response);

    const available = myRoster
      .filter(p => !bannedPlayers.includes(p))
      .filter(p => !alreadyPicked.includes(p))
      .map(p => ({ name: p, value: p }));

    await interaction.respond(available);
  }
});

client.login(token);