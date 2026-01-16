import { CommandInteraction, Client, ApplicationCommandType, ApplicationCommandOptionType, userMention, channelMention, MessageFlags, EmbedBuilder, Colors } from "discord.js";

export const openMatches = [];

function getAllBannedPlayers(match) {
  return Object.values(match.bans.rounds)
    .flat()
    .map(b => b.player);
}

function getOpponentId(match, userId) {
  return match.captains.find(id => id !== userId);
}

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

async function startMatch(interaction) {
  const user1 = interaction.options.getUser("user1", true);
  const user2 = interaction.options.getUser("user2", true);

  openMatches.push({
    channel: interaction.channelId,
    captains: [user1.id, user2.id],
    rosters: {},
    teamNames: {},
    bans: {
      round: 1,
      rounds: {}
    },
    blindPicks: [],
    phase: "roster"
  });

  await interaction.reply({
    embeds: [
      createEmbed({
        title: "Match Started",
        description: `${userMention(user1.id)} vs ${userMention(user2.id)}`,
        footer: "Phase: Roster Submission"
      })
    ]
  });
}

async function submitRoster(interaction) {
  const match = openMatches.find(m =>
    m.channel === interaction.channelId &&
    m.captains.includes(interaction.user.id)
  );

  if (!match) {
    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [
          createEmbed({
            description: "You are not a captain in an active match.",
            color: Colors.Grey
          })
        ]
    });
  }

  const teamName = interaction.options.getString("team", true);

  const roster = [
    interaction.options.getString("p1"),
    interaction.options.getString("p2"),
    interaction.options.getString("p3"),
    interaction.options.getString("p4"),
    interaction.options.getString("p5")
  ].filter(Boolean);

  match.rosters[interaction.user.id] = roster;
  match.teamNames[interaction.user.id] = teamName;

  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    embeds: [
        createEmbed({
          description: `Roster submitted for **${teamName}**.`,
          color: Colors.Grey
        })
      ]
  });

  if (Object.keys(match.rosters).length === 2) {
    match.phase = "ban";
    
    const [c1, c2] = match.captains;

    await interaction.channel.send({
      embeds: [
        createEmbed({
          title: "Rosters Locked In",
          fields: [
            {
              name: match.teamNames[c1],
              value: match.rosters[c1].join("\n"),
              inline: true
            },
            {
              name: match.teamNames[c2],
              value: match.rosters[c2].join("\n"),
              inline: true
            }
          ],
          footer: "Phase: Bans"
        })
      ]
    });
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

    await interaction.channel.send({
      embeds: [
        createEmbed({
          description: `${userMention(interaction.user.id)} (${match.teamNames[interaction.user.id]}) **passed** their ban.`,
          color: Colors.Grey
        })
      ]
    });
  }
  else {
    const opponentId = getOpponentId(match, interaction.user.id);
    const opponentRoster = match.rosters[opponentId] ?? [];

    if (!opponentRoster.includes(banned)) {
      return interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [
          createEmbed({
            description: "You can only ban players from your opponent's roster.",
            color: Colors.Grey
          })
        ]
    });
    }

    const bannedFromOpponent = Object.values(match.bans.rounds)
      .flat()
      .map(b => b.player)
      .filter(p => p && opponentRoster.includes(p));

    const remainingPlayers = opponentRoster.length - bannedFromOpponent.length;

    if (remainingPlayers <= 3) {
      return interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [
          createEmbed({
            description: "You cannot ban any more players. Your opponent must keep at least 3 (or less, if they start with less).",
            color: Colors.Grey
          })
        ]
    });
    }

    if (bannedFromOpponent.includes(banned)) {
      return interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [
          createEmbed({
            description: "That player has already been banned.",
            color: Colors.Grey
          })
        ]
    });
    }

    roundBans.push({
      by: interaction.user.id,
      player: banned
    });

    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [
          createEmbed({
            description: `Ban received: ${banned}`,
            color: Colors.Grey
          })
        ]
    });

    await interaction.channel.send({
      embeds: [
        createEmbed({
          description: `Ban received from ${userMention(interaction.user.id)} (${match.teamNames[interaction.user.id]})`
        })
      ]
    });
  }

  if (roundBans.length === 2) {
    await interaction.channel.send({
      embeds: [
        createEmbed({
          title: `Ban Round ${round} Results`,
          fields: roundBans.map(b => ({
            name: match.teamNames[b.by],
            value: b.player ?? "*Passed*",
            inline: true
          }))
        })
      ]
    });

    if (round === 2) {
      match.phase = "blindpick";
      await interaction.channel.send({
        embeds: [
          createEmbed({
            title: "Bans Complete",
            description: "Blind pick phase has begun.",
            footer: "Phase: Blind Pick"
          })
        ]
      });
    } else {
      match.bans.round++;
      await interaction.channel.send({
        embeds: [
          createEmbed({
            description: `Ban round ${match.bans.round} has begun.`
          })
        ]
      });
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
      embeds: [
          createEmbed({
            description: "No active match.",
            color: Colors.Grey
          })
        ]
    });
  }

  if (match.phase !== "blindpick") {
    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [
          createEmbed({
            description: "Blind picks are not available yet.",
            color: Colors.Grey
          })
        ]
    });
  }

  const pick = interaction.options.getString("player", true);
  const myRoster = match.rosters[interaction.user.id] ?? [];
  const allBanned = getAllBannedPlayers(match);
  const alreadyPicked = match.blindPicks.map(p => p.response);

  if (!myRoster.includes(pick)) {
    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [
          createEmbed({
            description: "You can only blindpick players from your own roster.",
            color: Colors.Grey
          })
        ]
    });
  }

  if (allBanned.includes(pick)) {
    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [
          createEmbed({
            description: "That player is banned.",
            color: Colors.Grey
          })
        ]
    });
  }

  let entry = match.blindPicks.find(p => p.id === interaction.user.id);

  if (entry && entry.response) {
    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [
          createEmbed({
            description: "You already submitted your blind pick.",
            color: Colors.Grey
          })
        ]
    });
  }

  if (!entry) {
    entry = { id: interaction.user.id };
    match.blindPicks.push(entry);
  }

  entry.response = pick;

  await interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [
          createEmbed({
            description: `Blind pick received: ${pick}`,
            color: Colors.Grey
          })
        ]
    });

  await interaction.channel.send({
    embeds: [
      createEmbed({
        description: `Blind pick received from ${userMention(interaction.user.id)} (${match.teamNames[interaction.user.id]}).`
      })
    ]
  });

  if (
    match.blindPicks.length === 2 &&
    match.blindPicks.every(p => p.response)
  ) {
    await interaction.channel.send({
      embeds: [
        createEmbed({
          title: "Blind Pick Results",
          fields: match.blindPicks.map(p => ({
            name: match.teamNames[p.id],
            value: p.response,
            inline: true
          })),
          color: Colors.Green,
          footer: "Blind Pick Complete"
        })
      ]
    });

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
          name: "team",
          description: "Team name",
          type: ApplicationCommandOptionType.String,
          required: true
        },
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