import { ApplicationCommandType, ApplicationCommandOptionType, ActivityType, MessageFlags } from "discord.js";

const organizerRole = "856957705688055868";

async function run(_client, interaction) {
  if (!interaction.isChatInputCommand()) return;

  const subcommand = interaction.options.getSubcommand();

  if (!interaction.inGuild() || !interaction.member.roles.cache.has(organizerRole)) {
    return interaction.reply({
      content: "No permission to use this command.",
      flags: MessageFlags.Ephemeral
    });
  }

  if (subcommand === "link") {
    const url = interaction.options.getString("url");
    const name = interaction.options.getString("name");
   
    if (!url.startsWith("http")) {
      return interaction.reply({
        content: "Provide a valid streaming URL.",
        flags: MessageFlags.Ephemeral
      });
    }

    await _client.user.setPresence({
      activities: [
        {
          name,
          type: ActivityType.Streaming,
          url: url
        }
      ],
      status: "online"
    });

    return interaction.reply({
      content: `Streaming status set!\n${url}`,
      flags: MessageFlags.Ephemeral
    });
  }

  if (subcommand === "unlink") {
    await _client.user.setPresence({
      activities: [],
      status: "online"
    });

    return interaction.reply({
      content: "Streaming status removed.",
      flags: MessageFlags.Ephemeral
    });
  }
};

export const stream = {
  name: "stream",
  description: "stream status",
  run,
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "link",
      description: "link a stream",
      options: [
        {
          type: ApplicationCommandOptionType.String,
          name: "url",
          description: "stream url",
          required: true
        },
        {
          type: ApplicationCommandOptionType.String,
          name: "name",
          description: "stream title",
          required: true
        }
      ]
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "unlink",
      description: "unlink stream"
    }
  ]
};