import { CommandInteraction, Client, ApplicationCommandType, ApplicationCommandOptionType, userMention, channelMention, MessageFlags } from "discord.js";

export const openMatches = [];

function getAllBannedPlayers(match) {
  return Object.values(match.bans.rounds)
    .flat()
    .map(b => b.player);
}

function getOpponentId(match, userId) {
  return match.captains.find(id => id !== userId);
}

function getBansAgainst(match, captainId) {
  return Object.values(match.bans.rounds)
    .flat()
    .filter(b => b.player && b.by !== captainId)
    .map(b => b.player);
}

async function startMatch(interaction) {
  const user1 = interaction.options.getUser("user1", true);
  const user2 = interaction.options.getUser("user2", true);

  openMatches.push({
    channel: interaction.channelId,
    captains: [user1.id, user2.id],
    rosters: {},
    bans: {
      round: 1,
      rounds: {}
    },
    blindPicks: [],
    phase: "roster"
  });

  await interaction.reply(
    `Match started between <@${user1.id}> and <@${user2.id}>`
  );
}

async function submitRoster(interaction) {
  const match = openMatches.find(m =>
    m.channel === interaction.channelId &&
    m.captains.includes(interaction.user.id)
  );

  if (!match) {
    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You are not a captain in an active match."
    });
  }

  const roster = [
    interaction.options.getString("p1"),
    interaction.options.getString("p2"),
    interaction.options.getString("p3"),
    interaction.options.getString("p4"),
    interaction.options.getString("p5")
  ].filter(Boolean);

  match.rosters[interaction.user.id] = roster;

  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    content: "Roster submitted."
  });

  if (Object.keys(match.rosters).length === 2) {
    match.phase = "ban";
    
    const [c1, c2] = match.captains;

    await interaction.channel.send(
      `**Rosters locked in:**\n\n`
      + `<@${c1}>:\n${match.rosters[c1].join(", ")}\n\n`
      + `<@${c2}>:\n${match.rosters[c2].join(", ")}`
    );
  }
}

async function banPlayer(interaction) {
  const banned = interaction.options.getString("player");

  const match = openMatches.find(m =>
    m.channel === interaction.channelId &&
    m.captains.includes(interaction.user.id)
  );

  if (!match) {
    return interaction.reply({ flags: MessageFlags.Ephemeral, content: "No active match." });
  }

  if (match.phase !== "ban") {
    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Bans are not available yet."
    });
  }

  const round = match.bans.round;
  if (!match.bans.rounds[round]) {
    match.bans.rounds[round] = [];
  }

  const roundBans = match.bans.rounds[round];

  if (roundBans.some(b => b.by === interaction.user.id)) {
    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You have already submitted your ban for this round."
    });
  }

  if (!banned) {
    roundBans.push({
      by: interaction.user.id,
      player: null
    });

    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You passed your ban."
    });

    await interaction.channel.send(
      `<@${interaction.user.id}> passed their ban.`
    );
  }
  else {
    const opponentId = getOpponentId(match, interaction.user.id);
    const opponentRoster = match.rosters[opponentId] ?? [];

    if (!opponentRoster.includes(banned)) {
      return interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "You can only ban players from your opponent's roster."
      });
    }

    const bansAgainstOpponent = getBansAgainst(match, interaction.user.id);
    const remainingPlayers = opponentRoster.length - bansAgainstOpponent.length;

    if (remainingPlayers <= 3) {
      return interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "You cannot ban any more players. Your opponent must keep at least 3."
      });
    }

    if (bansAgainstOpponent.includes(banned)) {
      return interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "That player has already been banned."
      });
    }

    roundBans.push({
      by: interaction.user.id,
      player: banned
    });

    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: `Ban received: ${banned}`
    });

    await interaction.channel.send(
      `Ban received from <@${interaction.user.id}>`
    );
  }

  if (roundBans.length === 2) {
    await interaction.channel.send(
      `**Ban Round ${round} Results:**\n`
      + roundBans
        .map(p => `<@${p.by}>: ${p.player ?? "_passed_"}`)
        .join("\n")
    );

    if (round === 2) {
      match.phase = "blindpick";
      await interaction.channel.send(
        `All bans complete.\n\nBlind pick phase has begun.`
      );
    } else {
      match.bans.round++;
      await interaction.channel.send(
        `Ban round ${match.bans.round} has begun.`
      );
    }
  }
}

async function blindPick(interaction) {
  const match = openMatches.find(m =>
    m.channel === interaction.channelId &&
    m.captains.includes(interaction.user.id)
  );

  if (!match) {
    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "No active match."
    });
  }

  if (match.phase !== "blindpick") {
    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Blind picks are not available yet."
    });
  }

  const pick = interaction.options.getString("player", true);
  const myRoster = match.rosters[interaction.user.id] ?? [];
  const allBanned = getAllBannedPlayers(match);
  const alreadyPicked = match.blindPicks.map(p => p.response);

  if (!myRoster.includes(pick)) {
    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You can only blind pick players from your own roster."
    });
  }

  if (allBanned.includes(pick)) {
    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "That player is banned."
    });
  }

  if (alreadyPicked.includes(pick)) {
    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "That player has already been picked."
    });
  }

  let entry = match.blindPicks.find(p => p.id === interaction.user.id);

  if (entry && entry.response) {
    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You already submitted your blind pick."
    });
  }

  if (!entry) {
    entry = { id: interaction.user.id };
    match.blindPicks.push(entry);
  }

  entry.response = pick;

  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    content: `Blind pick received: ${pick}`
  });

  await interaction.channel.send(
    `Blind pick received from <@${interaction.user.id}>`
  );

  if (
    match.blindPicks.length === 2 &&
    match.blindPicks.every(p => p.response)
  ) {
    await interaction.channel.send(
      `**Blind Pick Results:**\n`
      + match.blindPicks
        .map(p => `<@${p.id}>: ${p.response}`)
        .join("\n")
    );

    openMatches.splice(openMatches.indexOf(match), 1);
  }
}

async function run(client, interaction) {
  if (!interaction.isChatInputCommand()) return;

  const sub = interaction.options.getSubcommand();

  if (sub === "start") return startMatch(interaction);
  if (sub === "roster") return submitRoster(interaction);
  if (sub === "ban") return banPlayer(interaction);
  if (sub === "blindpick") return blindPick(interaction);
}

export const match = {
  name: "match",
  description: "Run a competitive match flow",
  type: ApplicationCommandType.ChatInput,
  run,
  options: [
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "start",
      description: "Start a match",
      options: [
        {
          name: "user1",
          description: "First captain",
          type: ApplicationCommandOptionType.User,
          required: true
        },
        {
          name: "user2",
          description: "Second captain",
          type: ApplicationCommandOptionType.User,
          required: true
        }
      ]
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "roster",
      description: "Submit your team roster",
      options: [
        {
          name: "p1",
          description: "Player 1",
          type: ApplicationCommandOptionType.String,
          required: false
        },
        {
          name: "p2",
          description: "Player 2",
          type: ApplicationCommandOptionType.String,
          required: false
        },
        {
          name: "p3",
          description: "Player 3",
          type: ApplicationCommandOptionType.String,
          required: false
        },
        {
          name: "p4",
          description: "Player 4",
          type: ApplicationCommandOptionType.String,
          required: false
        },
        {
          name: "p5",
          description: "Player 5",
          type: ApplicationCommandOptionType.String,
          required: false
        }
      ]
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "ban",
      description: "Ban a player",
      options: [
        {
          name: "player",
          description: "Player to ban (leave empty to pass)",
          type: ApplicationCommandOptionType.String,
          required: false,
          autocomplete: true
        }
      ]
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "blindpick",
      description: "Submit a blind pick",
      options: [
        {
          name: "player",
          description: "Your blind pick",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true
        }
      ]
    }
  ]
};