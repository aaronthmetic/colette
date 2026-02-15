import { ApplicationCommandType, ApplicationCommandOptionType, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { getStandingsFromCsv, sheetId, lowerGid, upperGid } from '../helpers/standings.js'
import { getAbbreviationsFromCsv, abbrGid } from '../helpers/abbreviations.js';

async function buildStandingsPage({ title, standings, page, perPage, abbrMap }) {
  const start = page * perPage;
  const slice = standings.slice(start, start + perPage);

  const lines = await Promise.all(
    slice.map(async (curr) => {
      const abbr = abbrMap.get(curr.participant) ?? curr.participant;
      return `${curr.rank.toString().padStart(2)}. ${abbr} - (${curr.score}-${curr.gamesplayed - curr.score} Record, ${curr.buchholz} Buchholz, Δ${curr.pointsdifference})`;
    })
  );

  const content =
    '\`\`\`' +
    `${title}\n` +
    lines.join('\n') +
    '\`\`\`';

  return content;
}

function buildButtons(page, maxPage) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('prev')
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),

    new ButtonBuilder()
      .setCustomId('next')
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= maxPage)
  );
}

async function handleStandings(interaction, title, gid) {
  const perPage = 0 < (interaction.options.getInteger("entries") ?? -1) && 17 > (interaction.options.getInteger("entries") ?? -1) ? interaction.options.getInteger("entries") : 10;

  let standings;
  try {
    standings = await getStandingsFromCsv(sheetId, gid);
  } catch (err) {
    return interaction.editReply({
      content: "Failed to load standings. Please try again later."
    });
  }

  if (!standings.length) {
    return interaction.editReply({
      content: "No standings available."
    });
  }

  let page = 0;
  const maxPage = Math.max(0, Math.floor((standings.length - 1) / perPage));

  const abbreviations = await getAbbreviationsFromCsv(sheetId, abbrGid);
  const abbrMap = new Map(
    abbreviations.map(a => [a.name, a.abbr])
  );

  const message = await interaction.editReply({
    content: await buildStandingsPage({ title, standings, page, perPage, abbrMap }),
    components: [buildButtons(page, maxPage)]
  });

  const collector = message.createMessageComponentCollector({
    time: 60000
  });

  collector.on("collect", async (btn) => {
    if (btn.user.id !== interaction.user.id) {
      return btn.reply({
        content: "Not your interaction.",
        flags: MessageFlags.Ephemeral
      });
    }

    if (btn.customId === "prev") {page--};
    if (btn.customId === "next") {page++};
    page = Math.max(0, Math.min(page, maxPage));

    await btn.update({
      content: await buildStandingsPage({ title, standings, page, perPage, abbrMap }),
      components: [buildButtons(page, maxPage)]
    });
  });

  collector.on("end", async () => {
    try {
      await interaction.editReply({ components: [] });
    }
    catch {

    }
  });
}

async function run(_client, interaction) {
  const subcommand = interaction.options.getSubcommand();

  await interaction.deferReply();

  if (subcommand === "lower") {
    await handleStandings(interaction, "LOWER STANDINGS", lowerGid);
  }

  if (subcommand === "upper") {
    await handleStandings(interaction, "UPPER STANDINGS", upperGid);
  }
};

export const standings = {
  name: "standings",
  description: "show standings",
  run,
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "upper",
      description: "upper division",
      options: [
        {
          name: "entries",
          description: "number of teams to show per page (default 10, max 16)",
          type: ApplicationCommandOptionType.Integer,
          required: false
        },
      ]
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "lower",
      description: "lower division",
      options: [
        {
          name: "entries",
          description: "number of teams to show per page (default 10, max 16)",
          type: ApplicationCommandOptionType.Integer,
          required: false
        },
      ],
    }
  ]
};