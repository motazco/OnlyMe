require("dotenv").config()
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require("discord.js")
const { REST } = require("@discordjs/rest")
const { Routes } = require("discord-api-types/v10")
const mongoose = require("mongoose")
const OpenAI = require("openai").default
const axios = require("axios")

const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY,
})

// نموذج MongoDB
const serverSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  channels: { type: [String], default: [] },
  isStopped: { type: Boolean, default: false },
})

const Server = mongoose.model("Server", serverSchema)

// تسجيل الأوامر
const commands = [
  {
    name: "ضيف",
    description: "ضيف قناة للتفاعل",
    options: [
      {
        name: "قناة",
        description: "اختار القناة",
        type: 7,
        required: true,
      },
    ],
  },
  {
    name: "شيل",
    description: "شيل قناة من التفاعل",
    options: [
      {
        name: "قناة",
        description: "اختار القناة",
        type: 7,
        required: true,
      },
    ],
  },
  {
    name: "وقف",
    description: "وقف البوت بالسيرفر هاد",
  },
  {
    name: "شغل",
    description: "شغل البوت بالسيرفر هاد",
  },
  {
    name: "مساعدة",
    description: "اعرض معلومات المساعدة",
  },
]

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
})

client.once("ready", async () => {
  console.log("✅ البوت شغال يا معلم!")

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN)
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands })
    console.log("✅ سجلنا الأوامر بنجاح يا باشا!")
  } catch (error) {
    console.error("❌ صارت مشكلة بتسجيل الأوامر:", error)
  }
})

// معالجة أوامر التفاعل (Slash Commands)
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand() && !interaction.isButton()) return

  const { commandName, guild, options } = interaction

  try {
    if (interaction.isButton()) {
      const [action, messageId, userId] = interaction.customId.split("_")
      if (action === "delete" && interaction.user.id === userId) {
        await interaction.message.delete()
        return
      } else if (action === "dm") {
        const originalMessage = await interaction.channel.messages.fetch(messageId)
        const dmContent = originalMessage.embeds[0].description
        try {
          await interaction.user.send(dmContent)
          await interaction.reply({ content: "بعتلك الرد عالخاص يا معلم!", ephemeral: true })
        } catch (error) {
          await interaction.reply({ content: "ما قدرت ابعتلك عالخاص، افتح الخاص تبعك!", ephemeral: true })
        }
        return
      }
    }

    switch (commandName) {
      case "ضيف": {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels)) {
          return interaction.reply({ content: "❌ لازم يكون عندك صلاحية إدارة القنوات يا صاحبي!", ephemeral: true })
        }
        const channel = options.getChannel("قناة")
        await Server.findOneAndUpdate(
          { guildId: guild.id },
          { $addToSet: { channels: channel.id } },
          { upsert: true, new: true },
        )
        interaction.reply(`✅ ضفنا ${channel} للقنوات النشطة يا معلم!`)
        break
      }
      case "شيل": {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels)) {
          return interaction.reply({ content: "❌ لازم يكون عندك صلاحية إدارة القنوات يا صاحبي!", ephemeral: true })
        }
        const channel = options.getChannel("قناة")
        await Server.findOneAndUpdate({ guildId: guild.id }, { $pull: { channels: channel.id } })
        interaction.reply(`✅ شلنا ${channel} من القنوات النشطة يا باشا!`)
        break
      }
      case "وقف": {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator)) {
          return interaction.reply({ content: "❌ لازم تكون أدمن عشان توقف البوت يا معلم!", ephemeral: true })
        }
        await Server.findOneAndUpdate({ guildId: guild.id }, { $set: { isStopped: true } }, { upsert: true })
        interaction.reply("⏹️ وقفنا البوت بالسيرفر هاد يا باشا!")
        break
      }
      case "شغل": {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator)) {
          return interaction.reply({ content: "❌ لازم تكون أدمن عشان تشغل البوت يا معلم!", ephemeral: true })
        }
        await Server.findOneAndUpdate({ guildId: guild.id }, { $set: { isStopped: false } }, { upsert: true })
        interaction.reply("▶️ شغلنا البوت بالسيرفر هاد يا باشا!")
        break
      }
      case "مساعدة": {
        const embed = new EmbedBuilder()
          .setTitle("🆘 مساعدة البوت")
          .addFields(
            { name: "المطور", value: `\`${process.env.OWNER_TAG}\`` },
            { name: "الدعم", value: process.env.SUPPORT_SERVER },
          )
          .setColor("#00ff00")
        interaction.reply({ embeds: [embed] })
        break
      }
      default:
        interaction.reply({ content: "❌ مش عارف الأمر هاد يا معلم!", ephemeral: true })
    }
  } catch (error) {
    console.error("❌ صارت مشكلة وقت تنفيذ الأمر:", error)
    const errorReply = "❌ صارت مشكلة وقت تنفيذ الأمر يا باشا! حاول كمان مرة."
    if (interaction.replied || interaction.deferred) {
      interaction.followUp({ content: errorReply, ephemeral: true })
    } else {
      interaction.reply({ content: errorReply, ephemeral: true })
    }
  }
})

// معالجة الرسائل النصية
client.on("messageCreate", async (message) => {
  if (message.author.bot) return

  const server = await Server.findOne({ guildId: message.guild.id })
  if (!server || server.isStopped || !server.channels.includes(message.channel.id)) return

  try {
    let prompt = message.content
    let imageUrl = null

    if (message.attachments.size > 0) {
      const attachment = message.attachments.first()
      if (attachment.contentType.startsWith("image/")) {
        imageUrl = attachment.url
        const response = await axios.get(imageUrl, { responseType: "arraybuffer" })
        const base64Image = Buffer.from(response.data, "binary").toString("base64")
        prompt += `\n[Image: data:${attachment.contentType};base64,${base64Image}]`
      }
    }

    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: "انت مساعد ذكي بتحكي باللهجة الفلسطينية. بتساعد الناس وبتجاوب على أسئلتهم بطريقة ودودة ومفهومة.",
        },
        { role: "user", content: prompt },
      ],
    })

    const replyContent = completion.choices[0].message.content

    const embed = new EmbedBuilder().setDescription(replyContent).setColor("#00ff00")

    if (imageUrl) {
      embed.setImage(imageUrl)
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`dm_${message.id}_${message.author.id}`)
        .setLabel("ابعتلي عالخاص")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`delete_${message.id}_${message.author.id}`)
        .setLabel("امسح الرد")
        .setStyle(ButtonStyle.Danger),
    )

    await message.reply({ embeds: [embed], components: [row] })
  } catch (error) {
    console.error("❌ صارت مشكلة مع ال API:", error)
    message.reply("❌ صارت مشكلة وأنا بحاول أجاوبك يا معلم! جرب كمان مرة.")
  }
})

// الاتصال بقاعدة البيانات وتشغيل البوت
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ اتصلنا بقاعدة البيانات يا باشا!")
    client.login(process.env.TOKEN)
  })
  .catch((err) => console.error("❌ ما قدرنا نتصل بقاعدة البيانات:", err))

