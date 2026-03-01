import { ApplicationCommandType, ApplicationCommandOptionType, MessageFlags, EmbedBuilder, Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { readStrings, writeStrings, readLeaderboard, generateLeaderboard, writeResults, convert } from '../helpers/pickems.js';

const pickemsCutoff = 1771714800;
const organizerRole = "856957705688055868";

function createEmbed({ title, description, fields, color, footer }) {
  const embed = new EmbedBuilder()
    .setColor(color ?? Colors.Blurple)
    .setTimestamp();

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (fields) embed.addFields(fields);
  if (footer) embed.setFooter({ text: footer });

  return embed;
}

async function run(_client, interaction) {
  const subcommand = interaction.options.getSubcommand();

  // REMOVE THIS LATER AFTER TESTING PHASE DONE
  /*
  if (!interaction.inGuild() || !interaction.member.roles.cache.has(organizerRole)) {
    return interaction.reply({
      content: "No permission to use this command.",
      flags: MessageFlags.Ephemeral
    });
  }
  */

  const isPublic = (subcommand === "leaderboard");

  await interaction.deferReply({
    flags: isPublic ? undefined : MessageFlags.Ephemeral
  });

  if (subcommand === "input") {
    const now = Math.floor(Date.now()/1000);

    if (now > pickemsCutoff) {
      return interaction.editReply({
        content: "Pickems submissions are now closed."
      });
    }

    const inputString = interaction.options.getString("string", true).trim();
    const userId = interaction.user.id;

    if (inputString.length !== 39 || !/^[0-9a-fA-F]+$/.test(inputString)) {
        return interaction.editReply({
            content: "Invalid pickems string. Please make sure you copied the string directly from the cell and that it's a 39-digit hex value."
        });
    }

    const pickemsData = await readStrings();

    const alreadyExists = Boolean(pickemsData[userId]);

    pickemsData[userId] = inputString;

    await writeStrings(pickemsData);

    await interaction.editReply({
      content: alreadyExists
        ? "Your pickems entry was updated."
        : "Your pickems entry was saved."
    });
  }

  if (subcommand === "verify") {
    const pickemsData = await readStrings();
    const entry = pickemsData[interaction.user.id];

    if (!entry) {
      return interaction.editReply({
        content: "You don't have a pickems entry saved yet."
      });
    }

    const { pickems } = convert(entry);

    const lines = Object.entries(pickems).map(([matchKey, matchData]) => {
      const { team, teamAScore, teamBScore } = matchData;
      const winner = team;
      const scoreLine = `${Math.max(teamAScore,teamBScore)}-${Math.min(teamAScore,teamBScore)}`;
      return `Match ${matchKey.toUpperCase()}: ${winner} (${scoreLine})`;
    });

    await interaction.editReply({
      content: `\`\`\`${lines.join("\n")}\`\`\``
    });
  }

  if (subcommand === "leaderboard") {
    await generateLeaderboard();

    const leaderboard = await readLeaderboard();

    if (!Array.isArray(leaderboard) || leaderboard.length === 0) {
      return interaction.editReply({
        content: "No leaderboard data yet."
      });
    }

    const userId = interaction.user.id;

    leaderboard.sort((a, b) =>
      b.score - a.score || a.pointDiff - b.pointDiff
    );

    const top10 = leaderboard.slice(0, 10);

    const description = top10
    .map((entry, index) =>
      `**${index + 1}.** <@${entry.uid}> — **${entry.score} pts** (Δ${entry.pointDiff})`
    )
    .join("\n");

    const userIndex = leaderboard.findIndex(e => e.uid === userId);

    let footer;
    if (userIndex !== -1 && userIndex >= 10) {
      const user = leaderboard[userIndex];
      footer = `Your rank: #${userIndex + 1} — ${user.score} pts (Δ${user.pointDiff})`;
    }

    const embed = createEmbed({
      title: "Pickems Leaderboard (Top 10)",
      description,
      footer
    });

    await interaction.editReply({
      embeds: [embed]
    });
  }

  if (subcommand === "setresults") {
    // organizer check
    if (!interaction.inGuild() || !interaction.member.roles.cache.has(organizerRole)) {
      return interaction.editReply({
        content: "No permission to use this command.",
        flags: MessageFlags.Ephemeral
      });
    }

    const inputString = interaction.options.getString("string", true).trim();
    const playedMatchesRaw = interaction.options.getString("playedmatches")?.trim().toLowerCase();

    if (inputString.length !== 39 || !/^[0-9a-fA-F]+$/.test(inputString)) {
      return interaction.editReply({
        content: "Invalid results string. Must be a 39-digit hex value."
      });
    }

    if (playedMatchesRaw && !/^[a-h]+$/.test(playedMatchesRaw)) {
      return interaction.editReply({
        content: "Played matches must only contain letters a-h (e.g. abcd)."
      });
    }

    const playedMatches = playedMatchesRaw ? [...new Set(playedMatchesRaw.split(""))] : [];

    await writeResults(inputString, playedMatches);

    await interaction.editReply({
      content: `Results updated.\nPlayed matches: ${playedMatches.join(",")}\nPickems string: ${inputString}`
    });
  }

  if (subcommand === "checkuserpickems") {
    // organizer check
    if (!interaction.inGuild() || !interaction.member.roles.cache.has(organizerRole)) {
      return interaction.editReply({
        content: "No permission to use this command.",
        flags: MessageFlags.Ephemeral
      });
    }

    const user = interaction.options.getUser("user", true);

    const leaderboard = await readLeaderboard();

    if (!Array.isArray(leaderboard) || leaderboard.length === 0) {
      return interaction.editReply({
        content: "No leaderboard data yet."
      });
    }

    const userPickems = leaderboard.find(entry => entry.uid === user.id);

    if (!userPickems) {
      return interaction.editReply({
        content: "That user has no pickems data."
      });
    }

    await interaction.editReply({
      content: `\`\`\`${JSON.stringify(userPickems, null, 2)}\`\`\``
    });
  }
}

export const pickems = {
  name: "pickems",
  description: "all things pickems related",
  run,
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "input",
      description: "input pickems string",
      options: [
        {
          name: "string",
          description: "the pickems string that you copied from the sheet",
          type: ApplicationCommandOptionType.String,
          required: true
        },
      ]
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "verify",
      description: "double check your input string is submitted and correct",
      options: [],
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "leaderboard",
      description: "view the top 10 pickems leaderboard"
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "setresults",
      description: "organizer use only: set the correct pickems string",
      options: [
        {
          name: "string",
          description: "the pickems string of the current outcomes",
          type: ApplicationCommandOptionType.String,
          required: true
        },
        {
          name: "playedmatches",
          description: "the letters of the matches that have been played e.g. abcd after the first round completed",
          type: ApplicationCommandOptionType.String,
          required: false
        }
      ]
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "checkuserpickems",
      description: "organizer use only: view a user's pickems",
      options: [
        {
          name: "user",
          description: "the user to check",
          type: ApplicationCommandOptionType.User,
          required: true
        }
      ]
    }
  ]
};