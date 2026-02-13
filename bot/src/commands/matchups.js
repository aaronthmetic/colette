import { ApplicationCommandType, ApplicationCommandOptionType, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { getMatchupsFromCsv, sheetId, lowerGid, upperGid } from '../helpers/matchups.js';
import { getAbbreviationsFromCsv, abbrGid } from '../helpers/abbreviations.js';

async function buildMatchupsPage({ title, matches, week, page, perPage, abbrMap }) {
  const start = page * perPage;
  const slice = matches.slice(start, start + perPage);
  
  const lines = await Promise.all(
    slice.map((curr) => {
      const t1abbr = abbrMap.get(curr.t1.team) ?? curr.t1.team;
      const t2abbr = abbrMap.get(curr.t2.team) ?? curr.t2.team;

      return curr.played ? `(${curr.t1.seed}) ${t1abbr} (${curr.t1.wl} ${curr.t1.score} - ${curr.t2.score} ${curr.t2.wl}) ${t2abbr} (${curr.t2.seed})` : `(${curr.t1.seed}) ${t1abbr} VS ${t2abbr} (${curr.t2.seed})`;
    })
  );

  const content =
    '\`\`\`' +
    `${title} FOR WEEK ${week}\n\n` +
    lines.join("\n\n") +
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

async function handleMatchups(interaction, title, gid) {
  const perPage = 0 < (interaction.options.getInteger("entries") ?? -1) && 17 > (interaction.options.getInteger("entries") ?? -1) ? interaction.options.getInteger("entries") : 10;

  let matchups;
  try {
    matchups = await getMatchupsFromCsv(sheetId, gid);
  } catch (err) {
    return interaction.editReply({
      content: "Failed to load matchups. Please try again later."
    });
  }

  if (!matchups.round || !Array.isArray(matchups[matchups.round])) {
    return interaction.editReply({ content: "No matchups available." });
  }

  const week = Object.keys(matchups).includes((interaction.options.getInteger("week") ?? matchups.round).toString()) ? interaction.options.getInteger("week") ?? matchups.round : matchups.round;

  const matches = matchups[week];

  if (!matches?.length) {
    return interaction.editReply({ content: "No matchups for this week." });
  }

  let page = 0;
  const maxPage = Math.max(0, Math.floor((matches.length - 1) / perPage));

  const abbreviations = await getAbbreviationsFromCsv(sheetId, abbrGid);
  const abbrMap = new Map(
    abbreviations.map(a => [a.name, a.abbr])
  );

  const message = await interaction.editReply({
    content: await buildMatchupsPage({ title, matches, week, page, perPage, abbrMap }),
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
      content: await buildMatchupsPage({ title, matches, week, page, perPage }),
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
    await handleMatchups(interaction, "LOWER MATCHUPS", lowerGid);
  }

  if (subcommand === "upper") {
    await handleMatchups(interaction, "UPPER MATCHUPS", upperGid);
  }
};

export const matchups = {
  name: "matchups",
  description: "show matchups",
  run,
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "upper",
      description: "upper division",
      options: [
        {
          name: "week",
          description: "week to show matchups for (default latest week)",
          type: ApplicationCommandOptionType.Integer,
          required: false
        },
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
          name: "week",
          description: "week to show matchups for (default latest week)",
          type: ApplicationCommandOptionType.Integer,
          required: false
        },
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