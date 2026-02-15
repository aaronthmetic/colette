import { ApplicationCommandType, ApplicationCommandOptionType, userMention, MessageFlags, EmbedBuilder, Colors, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { saveMatches, loadMatches } from '../helpers/matches.js';

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

async function canTalk(interaction) {
  const channel = interaction.channel;
  if (!channel || !channel.isTextBased()) return false;

  if (channel.isThread()) {
    if (channel.archived) return false;

    if (!channel.members.me) {
      try {
        await channel.join();
      } catch {
        return false;
      }
    }
  }

  const me = channel.guild?.members.me;
  if (!me) return false;

  const perms = channel.permissionsFor(me);
  if (!perms) return false;

  return perms.has([
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.EmbedLinks,
    channel.isThread()
      ? PermissionsBitField.Flags.SendMessagesInThreads
      : PermissionsBitField.Flags.SendMessages
  ]);
}

async function startMatch(interaction) {
  const user1 = interaction.options.getUser("user1", true);
  const user2 = interaction.options.getUser("user2", true);

  for (let i = openMatches.length - 1; i >= 0; i--) {
    const match = openMatches[i];
    if (
      match.captains.includes(user1.id) ||
      match.captains.includes(user2.id)
    ) {
      openMatches.splice(i, 1);
    }
  }

  openMatches.push({
    channel: interaction.channelId,
    captains: [user1.id, user2.id],
    rosters: {},
    pendingRosters: {},
    teamNames: {},
    bans: {
      round: 1,
      rounds: {}
    },
    blindPicks: [],
    phase: "roster"
  });

  await saveMatches(openMatches);

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

  if (match.phase !== "roster") {
    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [
        createEmbed({
          description: "Roster submission phase is over.",
          color: Colors.Grey
        })
      ]
    });
  }

  if (match.rosters[interaction.user.id]) {
    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [
        createEmbed({
          description: "You have already submitted your roster and cannot edit it.",
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

  if (roster.length < 1) {
    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [
        createEmbed({
          description: "You must submit at least one player.",
          color: Colors.Grey
        })
      ]
    });
  }

  if (new Set(roster).size !== roster.length) {
    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [
        createEmbed({
          description: "Duplicate player names are not allowed.",
          color: Colors.Grey
        })
      ]
    });
  }

  const opponentId = getOpponentId(match, interaction.user.id);
  const opponentRoster = match.rosters[opponentId] ?? [];

  const overlappingPlayers = roster.filter(p =>
    opponentRoster.includes(p)
  );

  if (overlappingPlayers.length > 0) {
    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [
        createEmbed({
          description: `These players are already on the opposing roster:\n${overlappingPlayers.join("\n")}`,
          color: Colors.Grey
        })
      ]
    });
  }

  match.pendingRosters[interaction.user.id] = { roster, teamName };

  await saveMatches(openMatches);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`confirm_roster_${interaction.user.id}`)
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`cancel_roster_${interaction.user.id}`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    embeds: [
      createEmbed({
        title: `Confirm Roster — ${teamName}`,
        description: roster.join("\n"),
        color: Colors.Grey,
        footer: "You have 60 seconds to confirm."
      })
    ],
    components: [row]
  });

  const reply = await interaction.fetchReply();

  const collector = reply.createMessageComponentCollector({
    time: 60_000
  });

  collector.on("end", async (_, reason) => {
    const stillPending = match.pendingRosters[interaction.user.id];

    if (!stillPending) return;

    delete match.pendingRosters[interaction.user.id];

    await saveMatches(openMatches);

    const disabledRow = new ActionRowBuilder().addComponents(
      row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
    );

    try {
      await interaction.editReply({
        embeds: [
          createEmbed({
            description: "Roster confirmation timed out. Submission canceled.",
            color: Colors.Red
          })
        ],
        components: [disabledRow]
      });
    } catch {
      
    }
  });
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

    await saveMatches(openMatches);

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

    await saveMatches(openMatches);

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
      await saveMatches(openMatches);
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
      await saveMatches(openMatches);
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
    await saveMatches(openMatches);
  }

  entry.response = pick;
  await saveMatches(openMatches);

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
    await saveMatches(openMatches);
  }
}

async function run(client, interaction) {
  if (interaction.isAutocomplete()) {
    const sub = interaction.options.getSubcommand();

    const match = openMatches.find(m =>
      m.channel === interaction.channelId &&
      m.captains.includes(interaction.user.id)
    );

    if (!match) return interaction.respond([]);

    // ---- BAN AUTOCOMPLETE ----
    if (sub === "ban") {
      if (match.phase !== "ban") {
        return interaction.respond([]);
      }

      const opponentId = getOpponentId(match, interaction.user.id);
      const opponentRoster = match.rosters[opponentId] ?? [];
      const bannedPlayers = getAllBannedPlayers(match);

      const available = opponentRoster
        .filter(p => !bannedPlayers.includes(p))
        .map(p => ({ name: p, value: p }));

      return interaction.respond(available.slice(0, 25));
    }

    // ---- BLINDPICK AUTOCOMPLETE ----
    if (sub === "blindpick") {
      if (match.phase !== "blindpick") {
        return interaction.respond([]);
      }

      const myRoster = match.rosters[interaction.user.id] ?? [];
      const bannedPlayers = getAllBannedPlayers(match);
      const alreadyPicked = match.blindPicks.map(p => p.response);

      const available = myRoster
        .filter(p => !bannedPlayers.includes(p))
        .filter(p => !alreadyPicked.includes(p))
        .map(p => ({ name: p, value: p }));

      return interaction.respond(available.slice(0, 25));
    }

    return interaction.respond([]);
  }

  if (interaction.isButton()) {
    const parts = interaction.customId.split("_");
    const action = parts[0];
    const userId = parts[2];

    const match = openMatches.find(m =>
      m.channel === interaction.channelId &&
      m.captains.includes(userId)
    );

    if (!match) {
      return interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "No active match."
      });
    }

    if (interaction.user.id !== userId) {
      return interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "This button is not for you."
      });
    }

    const pending = match.pendingRosters[userId];
    if (!pending) {
      return interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "No pending roster found."
      });
    }

    await interaction.deferUpdate();

    if (action === "confirm") {
      match.rosters[userId] = pending.roster;
      match.teamNames[userId] = pending.teamName;
      delete match.pendingRosters[userId];
      await saveMatches(openMatches);

      await interaction.editReply({
        embeds: [
          createEmbed({
            title: `Roster submitted for ${pending.teamName}`,
            description: pending.roster.join("\n"),
            color: Colors.Grey
          })
        ],
        components: []
      });

      await interaction.channel.send({
        embeds: [
          createEmbed({
            description: `Roster submitted for **${pending.teamName}**.`
          })
        ]
      });

      if (Object.keys(match.rosters).length === 2) {
        match.phase = "ban";
        await saveMatches(openMatches);

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

    if (action === "cancel") {
      delete match.pendingRosters[userId];
      await saveMatches(openMatches);

      await interaction.editReply({
        embeds: [
          createEmbed({
            description: "Roster submission canceled.",
            color: Colors.Grey
          })
        ],
        components: []
      });
    }

    return;
  }

  if (!interaction.isChatInputCommand()) return;

  if (!(await canTalk(interaction))) {
    try {
      return await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "❌ I don't have permission to send messages or embeds in this channel. Ping me to add me to the thread."
      });
    } catch {
      return;
    }
  }

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