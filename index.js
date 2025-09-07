// bot.js - Main bot file
const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Collections for commands and data
client.slashCommands = new Collection();
client.prefixCommands = new Collection();
client.config = {
    prefix: 't?',
    staffRoles: new Set(),
    staffUsers: new Set(),
    ticketChannels: new Map(),
    activeTickets: new Map(),
    ticketStats: new Map() // Changed from object to Map for guild-specific stats
};

// Load commands
const commandFolders = fs.readdirSync('./commands');
for (const folder of commandFolders) {
    const commandFiles = fs.readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(`./commands/${folder}/${file}`);
        if (command.data) {
            client.slashCommands.set(command.data.name, command);
        }
        if (command.name) {
            client.prefixCommands.set(command.name, command);
        }
    }
}

// Load events
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// Utility functions
client.utils = {
    // Check if user is staff
    isStaff: (member) => {
        if (client.config.staffUsers.has(member.id)) return true;
        return member.roles.cache.some(role => client.config.staffRoles.has(role.id));
    },

    // Create ticket channel
    createTicketChannel: async(guild, user, category) => {
        const channelName = `ticket-${user.username.toLowerCase()}-${Date.now().toString().slice(-4)}`;

        const channel = await guild.channels.create({
            name: channelName,
            type: 0, // Text channel
            parent: category,
            permissionOverwrites: [{
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                },
            ],
        });

        // Add staff permissions
        for (const roleId of client.config.staffRoles) {
            const role = guild.roles.cache.get(roleId);
            if (role) {
                await channel.permissionOverwrites.edit(role, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    ManageMessages: true
                });
            }
        }

        return channel;
    },

    // Create ticket embed
    createTicketEmbed: (type, data = {}) => {
        const embed = new EmbedBuilder();

        switch (type) {
            case 'setup':
                embed
                    .setTitle('🎫 Hỗ Trợ Tickets')
                    .setDescription('Nhấn vào nút bên dưới để tạo ticket hỗ trợ mới!')
                    .setColor('#00ff88')
                    .setFooter({ text: 'Ticket System v2.0' })
                    .setTimestamp();
                break;

            case 'created':
                embed
                    .setTitle('✅ Ticket Đã Được Tạo')
                    .setDescription(`Xin chào ${data.user}, ticket của bạn đã được tạo thành công!\n\nNhân viên sẽ sớm hỗ trợ bạn.`)
                    .setColor('#00ff88')
                    .addFields({ name: '🆔 Ticket ID', value: data.ticketId || 'N/A', inline: true }, { name: '⏰ Thời Gian Tạo', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true })
                    .setFooter({ text: 'Ticket System v2.0' })
                    .setTimestamp();
                break;

            case 'close_request':
                embed
                    .setTitle('🔒 Yêu Cầu Đóng Ticket')
                    .setDescription('Bạn có muốn đóng ticket này không?')
                    .setColor('#ff6b6b')
                    .setFooter({ text: 'Ticket System v2.0' })
                    .setTimestamp();
                break;

            case 'claimed':
                embed
                    .setTitle('👋 Ticket Đã Được Claim')
                    .setDescription(`Ticket này đã được claim bởi ${data.staff}`)
                    .setColor('#4ecdc4')
                    .setFooter({ text: 'Ticket System v2.0' })
                    .setTimestamp();
                break;
        }

        return embed;
    },

    // Create action buttons
    createButtons: (type) => {
        const row = new ActionRowBuilder();

        switch (type) {
            case 'setup':
                row.addComponents(
                    new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('📝 Tạo Ticket')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎫')
                );
                break;

            case 'ticket_controls':
                row.addComponents(
                    new ButtonBuilder()
                    .setCustomId('claim_ticket')
                    .setLabel('Claim')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🛡️'),
                    new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Đóng')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒'),
                    new ButtonBuilder()
                    .setCustomId('transcript_ticket')
                    .setLabel('Transcript')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📄')
                );
                break;

            case 'close_confirm':
                row.addComponents(
                    new ButtonBuilder()
                    .setCustomId('confirm_close')
                    .setLabel('Xác Nhận Đóng')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('✅'),
                    new ButtonBuilder()
                    .setCustomId('cancel_close')
                    .setLabel('Hủy')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❌')
                );
                break;
        }

        return row;
    },

    // Generate transcript
    generateTranscript: async(channel) => {
        try {
            // Check if client.db exists
            if (!client.db) {
                throw new Error('Database connection not available');
            }

            const ticket = await client.db.getTicket(channel.id);
            if (!ticket) {
                throw new Error('Ticket not found in database');
            }

            // Get messages from database first
            let messages = await client.db.getTicketMessages(ticket.id);

            // If no messages in DB, fetch from Discord and save
            if (messages.length === 0) {
                const discordMessages = await channel.messages.fetch({ limit: 100 });
                const messagesToSave = [];

                for (const [, msg] of discordMessages.reverse()) {
                    const messageData = {
                        message_id: msg.id,
                        author_id: msg.author.id,
                        author_username: msg.author.username,
                        author_discriminator: msg.author.discriminator,
                        author_avatar: msg.author.displayAvatarURL(),
                        content: msg.content,
                        attachments: msg.attachments.map(att => ({
                            name: att.name,
                            url: att.url,
                            size: att.size
                        })),
                        embeds: msg.embeds.map(embed => embed.toJSON()),
                        timestamp: msg.createdAt
                    };

                    await client.db.saveMessage(ticket.id, messageData);
                    messagesToSave.push(messageData);
                }

                messages = messagesToSave;
            }

            const transcript = {
                ticketId: ticket.ticket_id,
                channelName: channel.name,
                channelId: channel.id,
                guildId: channel.guild.id,
                userId: ticket.user_id,
                createdAt: ticket.created_at,
                closedAt: new Date(),
                messages: messages.map(msg => ({
                    author: {
                        id: msg.author_id,
                        username: msg.author_username,
                        discriminator: msg.author_discriminator,
                        avatar: msg.author_avatar
                    },
                    content: msg.content,
                    timestamp: msg.timestamp,
                    attachments: msg.attachments || [],
                    embeds: msg.embeds || []
                }))
            };

            // Save transcript to file
            const transcriptId = `${ticket.ticket_id}-${Date.now()}`;
            const transcriptPath = path.join('./transcripts', `${transcriptId}.json`);

            if (!fs.existsSync('./transcripts')) {
                fs.mkdirSync('./transcripts', { recursive: true });
            }

            fs.writeFileSync(transcriptPath, JSON.stringify(transcript, null, 2));

            // Update ticket with transcript ID
            await client.db.updateTicket(channel.id, { transcript_id: transcriptId });

            return transcriptId;
        } catch (error) {
            console.error('Error generating transcript:', error);
            throw error;
        }
    },

    // Auto-save messages for active tickets
    autoSaveMessage: async(message) => {
        try {
            if (message.author.bot) return;

            // Check if client.db exists
            if (!client.db) return;

            const ticket = await client.db.getTicket(message.channel.id);
            if (!ticket) return; // Not a ticket channel

            const messageData = {
                message_id: message.id,
                author_id: message.author.id,
                author_username: message.author.username,
                author_discriminator: message.author.discriminator,
                author_avatar: message.author.displayAvatarURL(),
                content: message.content,
                attachments: message.attachments.map(att => ({
                    name: att.name,
                    url: att.url,
                    size: att.size
                })),
                embeds: message.embeds.map(embed => embed.toJSON()),
                timestamp: message.createdAt
            };

            await client.db.saveMessage(ticket.id, messageData);
        } catch (error) {
            console.error('Error auto-saving message:', error);
        }
    },

    // Get guild stats
    getGuildStats: (guildId) => {
        return client.config.ticketStats.get(guildId) || {
            total: 0,
            closed: 0,
            claimed: 0,
            open: 0
        };
    },

    // Update guild stats
    updateGuildStats: async(guildId, statsUpdate) => {
        try {
            const currentStats = client.config.ticketStats.get(guildId) || {
                total: 0,
                closed: 0,
                claimed: 0,
                open: 0
            };

            Object.keys(statsUpdate).forEach(key => {
                currentStats[key] = (currentStats[key] || 0) + statsUpdate[key];
            });

            client.config.ticketStats.set(guildId, currentStats);

            // Save to database if available
            if (client.db) {
                await client.db.updateDailyStats(guildId, statsUpdate);
            }
        } catch (error) {
            console.error('Error updating guild stats:', error);
        }
    }
};

// Error handling
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

client.login(process.env.DISCORD_TOKEN);