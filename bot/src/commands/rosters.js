import { ApplicationCommandType, ApplicationCommandOptionType, EmbedBuilder, Colors, escapeMarkdown } from "discord.js";
import { getRostersFromCsv, sheetId, rosterGid } from '../helpers/rosters.js'
import { getAbbreviationFromTeam, getAbbreviationsFromCsv, abbrGid } from '../helpers/abbreviations.js';
import { getUserData } from "../helpers/tlStats.js";

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

async function showRoster(interaction, teamName) {
  try {
    const rosters = await getRostersFromCsv(sheetId, rosterGid);

    const team = rosters.find(
      obj => obj.team?.toLowerCase() === teamName?.toLowerCase()
    );

    if (!team) {
      return interaction.editReply({
        embeds: [
          createEmbed({
            description: "Team not found.",
            color: Colors.Red
          })
        ]
      });
    }

    const abbr = await getAbbreviationFromTeam(team.team, sheetId, abbrGid) ?? team.team;

    const starters = Array.isArray(team.players) ? team.players : [];
    const subs = Array.isArray(team.subs) ? team.subs : [];

    async function fetchWithStats(username) {
      const clean = username.toLowerCase().trim();
      const data = await getUserData(clean);

      return {
        username,
        glicko: data?.glicko ?? -1,
        rank: data?.rank ?? null
      };
    }

    const starterData = await Promise.all(
      starters.map(player => fetchWithStats(player))
    );

    const subData = await Promise.all(
      subs.map(player => fetchWithStats(player))
    );

    starterData.sort((a, b) => b.glicko - a.glicko);
    subData.sort((a, b) => b.glicko - a.glicko);

    const formattedStarters = starterData.map(player => {
      const safeUsername = escapeMarkdown(player.username);

      return player.rank
        ? `${safeUsername} — ${player.rank.toUpperCase()} (${Math.round(player.glicko)})`
        : `${safeUsername} — N/A`
    });

    const formattedSubs = subData.map(player => {
      const safeUsername = escapeMarkdown(player.username);

      return player.rank
        ? `${safeUsername} — ${player.rank.toUpperCase()} (${Math.round(player.glicko)})`
        : `${safeUsername} — N/A`
    });

    const embed = createEmbed({
      title: `${team.team} (Seed ${team.seed}, Abbreviation: ${abbr})`,
      fields: [
        {
          name: "Starters",
          value: formattedStarters.length ? formattedStarters.join("\n"): "None",
          inline: true
        },
        {
          name: "Subs",
          value: formattedSubs.length ? formattedSubs.join("\n") : "None",
          inline: true
        }
      ]
    });

    await interaction.editReply({ embeds: [embed] });

  } catch (err) {
    console.error(err);
    await interaction.editReply({
      content: "Error fetching roster."
    });
  }
}

async function run(_client, interaction) {
  if (!interaction.isAutocomplete()) {
    await interaction.deferReply();
  }

  if (interaction.isAutocomplete()) {
    const focused = interaction.options.getFocused();

    try {
      const rosters = await getRostersFromCsv(sheetId, rosterGid);
      const abbreviations = await getAbbreviationsFromCsv(sheetId, abbrGid);

      const teams = rosters.map(obj => {
        const found = abbreviations.find(a => a.name === obj.team);
        const abbr = found ? found.abbr : obj.team;

        return {
          name: `${obj.team} (${abbr})`,
          value: obj.team
        };
      });

      const filtered = teams
        .filter(team =>
          team.name.toLowerCase().includes(focused.toLowerCase())
        )
        .slice(0, 25);

      await interaction.respond(filtered);
    } catch (err) {
      console.error(err);
      await interaction.respond([]);
    }

    return;
  }

  const teamName = interaction.options.getString("team");

  await showRoster(interaction, teamName);
};

export const rosters = {
  name: "rosters",
  description: "show roster",
  run,
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: "team",
      description: "team",
      required: true,
      autocomplete: true
    }
  ]
};