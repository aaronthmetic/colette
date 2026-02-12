import { ApplicationCommandType, ApplicationCommandOptionType, EmbedBuilder, Colors } from "discord.js";
import { getRostersFromCsv, sheetId, rosterGid } from '../helpers/rosters.js'
import { getAbbreviationFromTeam, getAbbreviationsFromCsv, abbrGid } from '../helpers/abbreviations.js';

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
      obj => obj.team.toLowerCase() === teamName.toLowerCase()
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

    const embed = createEmbed({
      title: `${team.team} (Seed ${team.seed}, Abbreviation: ${await getAbbreviationFromTeam(team.team, sheetId, abbrGid)})`,
      fields: [
        {
          name: "Starters",
          value: team.players.join("\n") || "None",
          inline: true
        },
        {
          name: "Subs",
          value: team.subs.join("\n") || "None",
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
  await interaction.deferReply();

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