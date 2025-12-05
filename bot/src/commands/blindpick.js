import { CommandInteraction, Client, ApplicationCommandType, ApplicationCommandOptionType, userMention, channelMention, MessageFlags } from "discord.js";

let openPicks = [];

async function initBlindPick(interaction) {
  if (!interaction.isChatInputCommand()) return;

  const user1 = interaction.options.getUser("user1", true);
  const user2 = interaction.options.getUser("user2", true);
  const name = interaction.options.getString("name")

  openPicks.push({
    name,
    channel: interaction.channelId,
    responses: [
      { id: user1.id, response: undefined },
      { id: user2.id, response: undefined },
    ]
  })

  await interaction.reply({
    content: `${name ?? "Blind pick"} between ${userMention(user1.id)} and ${userMention(user2.id)} initiated.`
  });
}

async function respondToBlindPick(interaction) {
  if (!interaction.isChatInputCommand()) return;
  const inputtedResponse = interaction.options.getString("response", true)

  const openPick = openPicks.find(pick =>
    pick.channel === interaction.channelId &&
    pick.responses.some(res => res.id === interaction.user.id && !res.response)
  )

  if (!openPick) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: `You are not a part of any open blind picks in ${channelMention(interaction.channelId)}.`
    });
    return
  }

  const responseToFill = openPick.responses.find(res =>
    res.id === interaction.user.id && !res.response
  );

  responseToFill.response = inputtedResponse;

  // ephemeral response, only visible to user
  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    content: `Received ${inputtedResponse}`
  });

  // public response
  if (interaction.channel?.isSendable()) {
    await interaction.channel.send(
      `Response received from ${userMention(interaction.user.id)}`
    )
  }

  // announce results and delete the blind pick if it's complete.
  if (openPick.responses.every(res => !!res.response)) {
    if (interaction.channel?.isSendable()) {
      interaction.channel.send(
        `${openPick.name ?? "Blind Pick"} Result: \n`
        + openPick.responses.map(({ id, response }) => `${userMention(id)}: ${response} `).join("\n")
      )
    }
    openPicks = openPicks.filter(e => e !== openPick)
  }

}

async function run(client, interaction) {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.options.getSubcommand() === "start")
    initBlindPick(interaction);
  else
    respondToBlindPick(interaction);
}

export const blindpick = {
  name: "blindpick",
  description: "run a blind pick between two users",
  run,
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "respond",
      description: "respond to the first open blind pick you are a part of in the current channel",
      options: [
        {
          name: "response",
          description: "Your response to the blind pick event",
          type: ApplicationCommandOptionType.String,
          required: true
        },
      ]
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "start",
      description: "starts a blindpick between two users",
      options: [
        {
          name: "user1",
          description: "1 of 2 participants in the blind pick",
          type: ApplicationCommandOptionType.User,
          required: true
        },
        {
          name: "user2",
          description: "2 of 2 participants in the blind pick",
          type: ApplicationCommandOptionType.User,
          required: true
        },
        {
          name: "name",
          description: "Optional name of the blind pick event",
          type: ApplicationCommandOptionType.String,
        },
      ],
    }
  ]
};