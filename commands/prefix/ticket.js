// commands/prefix/ticket.js - Prefix version of ticket commands
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'ticket',
    description: 'Quản lý hệ thống tickets (prefix version)',
    usage: 't?ticket <subcommand> [args]',
    async execute(message, args, client) {
        const subcommand = args.length > 0 ? args[0].toLowerCase() : null;
        const member = message.member;

        // Check staff permissions (except for close command)
        if (subcommand !== 'close' && !client.utils.isStaff(member) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Bạn không có quyền sử dụng lệnh này!');
        }

        switch (subcommand) {
            case 'setup':
                await this.handleSetup(message, args, client);
                break;
            case 'force-close':
                await this.handleForceClose(message, args, client);
                break;
            case 'close':
                await this.handleClose(message, args, client);
                break;
            case 'stats':
                await this.handleStats(message, args, client);
                break;
            case 'claim':
                await this.handleClaim(message, args, client);
                break;
            case 'transcript':
                await this.handleTranscript(message, args, client);
                break;
            case 'status':
                await this.handleStatus(message, args, client);
                break;
            case 'add-staff':
                await this.handleAddStaff(message, args, client);
                break;
            case 'user-staff':
                await this.handleUserStaff(message, args, client);
                break;
            default:
                await this.showHelp(message, client);
                break;
        }
    },

    async handleSetup(message, args, client) {
        const channelMention = args[1];
        if (!channelMention) {
            return message.reply('❌ Vui lòng mention kênh! Ví dụ: `t?ticket setup #general`');
        }

        const channel = message.mentions.channels.first() || message.guild.channels.cache.get(channelMention);
        if (!channel) {
            return message.reply('❌ Không tìm thấy kênh!');
        }

        const embed = client.utils.createTicketEmbed('setup');
        const buttons = client.utils.createButtons('setup');

        try {
            await channel.send({
                embeds: [embed],
                components: [buttons]
            });

            client.config.ticketChannels.set(channel.id, {
                guildId: message.guild.id,
                setupBy: message.author.id,
                setupAt: Date.now()
            });

            message.reply(`✅ Đã thiết lập hệ thống ticket trong ${channel}`);
        } catch (error) {
            message.reply('❌ Có lỗi xảy ra khi thiết lập ticket!');
        }
    },

    async handleForceClose(message, args, client) {
        const channel = message.channel;

        if (!channel.name.startsWith('ticket-')) {
            return message.reply('❌ Lệnh này chỉ có thể sử dụng trong kênh ticket!');
        }

        try {
            const transcriptId = await client.utils.generateTranscript(channel);

            client.config.ticketStats.closed++;
            client.config.ticketStats.open--;
            client.config.activeTickets.delete(channel.id);

            message.reply('🔒 Ticket sẽ bị đóng trong 5 giây...');

            setTimeout(async() => {
                await channel.delete();
            }, 5000);

        } catch (error) {
            message.reply('❌ Có lỗi xảy ra khi đóng ticket!');
        }
    },

    async handleClose(message, args, client) {
        const channel = message.channel;

        if (!channel.name.startsWith('ticket-')) {
            return message.reply('❌ Lệnh này chỉ có thể sử dụng trong kênh ticket!');
        }

        const embed = client.utils.createTicketEmbed('close_request');
        const buttons = client.utils.createButtons('close_confirm');

        await message.reply({
            embeds: [embed],
            components: [buttons]
        });
    },

    async handleStats(message, args, client) {
        const channelMention = args[1];
        let targetChannel = message.channel;

        if (channelMention) {
            targetChannel = message.mentions.channels.first() || message.guild.channels.cache.get(channelMention);
            if (!targetChannel) targetChannel = message.channel;
        }

        const stats = client.config.ticketStats;

        const embed = new EmbedBuilder()
            .setTitle('📊 Thống Kê Tickets')
            .setColor('#4ecdc4')
            .addFields({ name: '📝 Tổng Tickets', value: stats.total.toString(), inline: true }, { name: '🔓 Đang Mở', value: stats.open.toString(), inline: true }, { name: '🔒 Đã Đóng', value: stats.closed.toString(), inline: true }, { name: '🛡️ Đã Claim', value: stats.claimed.toString(), inline: true }, { name: '⏰ Uptime', value: `<t:${Math.floor((Date.now() - client.readyTimestamp) / 1000)}:R>`, inline: true }, { name: '🤖 Bot Status', value: '🟢 Online', inline: true })
            .setFooter({ text: 'Ticket System v2.0' })
            .setTimestamp();

        if (targetChannel.id === message.channel.id) {
            await message.reply({ embeds: [embed] });
        } else {
            await targetChannel.send({ embeds: [embed] });
            await message.reply(`✅ Đã gửi thống kê vào ${targetChannel}`);
        }
    },

    async handleClaim(message, args, client) {
        const channel = message.channel;

        if (!channel.name.startsWith('ticket-')) {
            return message.reply('❌ Lệnh này chỉ có thể sử dụng trong kênh ticket!');
        }

        const ticketData = client.config.activeTickets.get(channel.id);
        if (ticketData && ticketData.claimedBy) {
            return message.reply('❌ Ticket này đã được claim!');
        }

        client.config.activeTickets.set(channel.id, {
            ...ticketData,
            claimedBy: message.author.id,
            claimedAt: Date.now()
        });

        client.config.ticketStats.claimed++;

        const embed = client.utils.createTicketEmbed('claimed', {
            staff: message.author
        });

        await message.reply({ embeds: [embed] });
    },

    async handleTranscript(message, args, client) {
        const channel = message.channel;

        if (!channel.name.startsWith('ticket-')) {
            return message.reply('❌ Lệnh này chỉ có thể sử dụng trong kênh ticket!');
        }

        try {
            const transcriptId = await client.utils.generateTranscript(channel);
            const transcriptUrl = `${process.env.WEBSITE_URL}/transcript/${transcriptId}`;

            message.reply(`📄 **Transcript đã được tạo!**\n🔗 Link: ${transcriptUrl}`);
        } catch (error) {
            message.reply('❌ Có lỗi xảy ra khi tạo transcript!');
        }
    },

    async handleStatus(message, args, client) {
        const embed = new EmbedBuilder()
            .setTitle('🤖 Trạng Thái Bot')
            .setColor('#00ff88')
            .addFields({ name: '📶 Ping', value: `${client.ws.ping}ms`, inline: true }, { name: '⏰ Uptime', value: `<t:${Math.floor((Date.now() - client.readyTimestamp) / 1000)}:R>`, inline: true }, { name: '🗃️ Guilds', value: client.guilds.cache.size.toString(), inline: true }, { name: '👥 Users', value: client.users.cache.size.toString(), inline: true }, { name: '💾 Memory', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, inline: true }, { name: '📊 Active Tickets', value: client.config.activeTickets.size.toString(), inline: true })
            .setFooter({ text: 'Ticket System v2.0' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },

    async handleAddStaff(message, args, client) {
        const roleMention = args[1];
        if (!roleMention) {
            return message.reply('❌ Vui lòng mention role! Ví dụ: `t?ticket add-staff @Staff`');
        }

        const role = message.mentions.roles.first() || message.guild.roles.cache.get(roleMention);
        if (!role) {
            return message.reply('❌ Không tìm thấy role!');
        }

        if (client.config.staffRoles.has(role.id)) {
            return message.reply('❌ Role này đã được thêm vào danh sách staff!');
        }

        client.config.staffRoles.add(role.id);
        message.reply(`✅ Đã thêm role ${role} vào danh sách staff!`);
    },

    async handleUserStaff(message, args, client) {
        const userMention = args[1];
        if (!userMention) {
            return message.reply('❌ Vui lòng mention user! Ví dụ: `t?ticket user-staff @User`');
        }

        const user = message.mentions.users.first() || await client.users.fetch(userMention).catch(() => null);
        if (!user) {
            return message.reply('❌ Không tìm thấy user!');
        }

        if (client.config.staffUsers.has(user.id)) {
            return message.reply('❌ User này đã được thêm vào danh sách staff!');
        }

        client.config.staffUsers.add(user.id);
        message.reply(`✅ Đã thêm ${user} vào danh sách staff!`);
    },

    async showHelp(message, client) {
        const embed = new EmbedBuilder()
            .setTitle('🎫 Hệ Thống Ticket - Hướng Dẫn')
            .setColor('#4ecdc4')
            .setDescription('Các lệnh available với prefix `t?`')
            .addFields({ name: '📝 Setup', value: '`t?ticket setup #channel` - Thiết lập kênh tạo ticket', inline: false }, { name: '🔒 Force Close', value: '`t?ticket force-close` - Bắt buộc đóng ticket', inline: false }, { name: '❌ Close', value: '`t?ticket close` - Yêu cầu đóng ticket', inline: false }, { name: '📊 Stats', value: '`t?ticket stats [#channel]` - Xem thống kê', inline: false }, { name: '🛡️ Claim', value: '`t?ticket claim` - Claim ticket hiện tại', inline: false }, { name: '📄 Transcript', value: '`t?ticket transcript` - Lấy transcript', inline: false }, { name: '🤖 Status', value: '`t?ticket status` - Xem trạng thái bot', inline: false }, { name: '➕ Add Staff', value: '`t?ticket add-staff @role` - Thêm role staff', inline: false }, { name: '👤 User Staff', value: '`t?ticket user-staff @user` - Thêm user staff', inline: false })
            .setFooter({ text: 'Ticket System v2.0' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }
};