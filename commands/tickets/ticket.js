// commands/tickets/ticket.js - Main ticket slash command
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Quản lý hệ thống tickets')
        .addSubcommand(subcommand =>
            subcommand
            .setName('setup')
            .setDescription('Thiết lập kênh tạo tickets')
            .addChannelOption(option =>
                option
                .setName('channel')
                .setDescription('Kênh để gửi tin nhắn tạo ticket')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
            )
        )
        .addSubcommand(subcommand =>
            subcommand
            .setName('force-close')
            .setDescription('Bắt buộc đóng ticket hiện tại')
        )
        .addSubcommand(subcommand =>
            subcommand
            .setName('close')
            .setDescription('Yêu cầu đóng ticket')
        )
        .addSubcommand(subcommand =>
            subcommand
            .setName('stats')
            .setDescription('Xem thống kê tickets')
            .addChannelOption(option =>
                option
                .setName('channel')
                .setDescription('Kênh để gửi thống kê')
                .addChannelTypes(ChannelType.GuildText)
            )
        )
        .addSubcommand(subcommand =>
            subcommand
            .setName('claim')
            .setDescription('Claim ticket hiện tại')
        )
        .addSubcommand(subcommand =>
            subcommand
            .setName('transcript')
            .setDescription('Lấy transcript của ticket')
        )
        .addSubcommand(subcommand =>
            subcommand
            .setName('status')
            .setDescription('Xem trạng thái của bot')
        )
        .addSubcommand(subcommand =>
            subcommand
            .setName('add-staff')
            .setDescription('Thêm role staff')
            .addRoleOption(option =>
                option
                .setName('role')
                .setDescription('Role staff cần thêm')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
            subcommand
            .setName('user-staff')
            .setDescription('Thêm user staff')
            .addUserOption(option =>
                option
                .setName('user')
                .setDescription('User staff cần thêm')
                .setRequired(true)
            )
        ),

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const member = interaction.member;

        // Check staff permissions (except for close command)
        if (subcommand !== 'close' && !client.utils.isStaff(member) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ Bạn không có quyền sử dụng lệnh này!',
                ephemeral: true
            });
        }

        switch (subcommand) {
            case 'setup':
                await this.handleSetup(interaction, client);
                break;
            case 'force-close':
                await this.handleForceClose(interaction, client);
                break;
            case 'close':
                await this.handleClose(interaction, client);
                break;
            case 'stats':
                await this.handleStats(interaction, client);
                break;
            case 'claim':
                await this.handleClaim(interaction, client);
                break;
            case 'transcript':
                await this.handleTranscript(interaction, client);
                break;
            case 'status':
                await this.handleStatus(interaction, client);
                break;
            case 'add-staff':
                await this.handleAddStaff(interaction, client);
                break;
            case 'user-staff':
                await this.handleUserStaff(interaction, client);
                break;
        }
    },

    async handleSetup(interaction, client) {
        const channel = interaction.options.getChannel('channel');

        const embed = client.utils.createTicketEmbed('setup');
        const buttons = client.utils.createButtons('setup');

        try {
            await channel.send({
                embeds: [embed],
                components: [buttons]
            });

            client.config.ticketChannels.set(channel.id, {
                guildId: interaction.guild.id,
                setupBy: interaction.user.id,
                setupAt: Date.now()
            });

            await interaction.reply({
                content: `✅ Đã thiết lập hệ thống ticket trong ${channel}`,
                ephemeral: true
            });
        } catch (error) {
            await interaction.reply({
                content: '❌ Có lỗi xảy ra khi thiết lập ticket!',
                ephemeral: true
            });
        }
    },

    async handleForceClose(interaction, client) {
        const channel = interaction.channel;

        if (!channel.name.startsWith('ticket-')) {
            return interaction.reply({
                content: '❌ Lệnh này chỉ có thể sử dụng trong kênh ticket!',
                ephemeral: true
            });
        }

        try {
            // Generate transcript before closing
            const transcriptId = await client.utils.generateTranscript(channel);

            // Update stats
            client.config.ticketStats.closed++;
            client.config.ticketStats.open--;

            // Remove from active tickets
            client.config.activeTickets.delete(channel.id);

            await interaction.reply('🔒 Ticket sẽ bị đóng trong 5 giây...');

            setTimeout(async() => {
                await channel.delete();
            }, 5000);

        } catch (error) {
            await interaction.reply({
                content: '❌ Có lỗi xảy ra khi đóng ticket!',
                ephemeral: true
            });
        }
    },

    async handleClose(interaction, client) {
        const channel = interaction.channel;

        if (!channel.name.startsWith('ticket-')) {
            return interaction.reply({
                content: '❌ Lệnh này chỉ có thể sử dụng trong kênh ticket!',
                ephemeral: true
            });
        }

        const embed = client.utils.createTicketEmbed('close_request');
        const buttons = client.utils.createButtons('close_confirm');

        await interaction.reply({
            embeds: [embed],
            components: [buttons]
        });
    },

    async handleStats(interaction, client) {
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const stats = client.config.ticketStats;

        const embed = new EmbedBuilder()
            .setTitle('📊 Thống Kê Tickets')
            .setColor('#4ecdc4')
            .addFields({ name: '📝 Tổng Tickets', value: stats.total.toString(), inline: true }, { name: '🔓 Đang Mở', value: stats.open.toString(), inline: true }, { name: '🔒 Đã Đóng', value: stats.closed.toString(), inline: true }, { name: '🛡️ Đã Claim', value: stats.claimed.toString(), inline: true }, { name: '⏰ Uptime', value: `<t:${Math.floor((Date.now() - client.readyTimestamp) / 1000)}:R>`, inline: true }, { name: '🤖 Bot Status', value: '🟢 Online', inline: true })
            .setFooter({ text: 'Ticket System v2.0' })
            .setTimestamp();

        if (channel.id === interaction.channel.id) {
            await interaction.reply({ embeds: [embed] });
        } else {
            await channel.send({ embeds: [embed] });
            await interaction.reply({
                content: `✅ Đã gửi thống kê vào ${channel}`,
                ephemeral: true
            });
        }
    },

    async handleClaim(interaction, client) {
        const channel = interaction.channel;

        if (!channel.name.startsWith('ticket-')) {
            return interaction.reply({
                content: '❌ Lệnh này chỉ có thể sử dụng trong kênh ticket!',
                ephemeral: true
            });
        }

        const ticketData = client.config.activeTickets.get(channel.id);
        if (ticketData && ticketData.claimedBy) {
            return interaction.reply({
                content: '❌ Ticket này đã được claim!',
                ephemeral: true
            });
        }

        // Update ticket data
        client.config.activeTickets.set(channel.id, {
            ...ticketData,
            claimedBy: interaction.user.id,
            claimedAt: Date.now()
        });

        client.config.ticketStats.claimed++;

        const embed = client.utils.createTicketEmbed('claimed', {
            staff: interaction.user
        });

        await interaction.reply({ embeds: [embed] });
    },

    async handleTranscript(interaction, client) {
        const channel = interaction.channel;

        if (!channel.name.startsWith('ticket-')) {
            return interaction.reply({
                content: '❌ Lệnh này chỉ có thể sử dụng trong kênh ticket!',
                ephemeral: true
            });
        }

        try {
            await interaction.deferReply({ ephemeral: true });

            const transcriptId = await client.utils.generateTranscript(channel);
            const transcriptUrl = `${process.env.WEBSITE_URL}/transcript/${transcriptId}`;

            await interaction.editReply({
                content: `📄 **Transcript đã được tạo!**\n🔗 Link: ${transcriptUrl}`
            });
        } catch (error) {
            await interaction.editReply({
                content: '❌ Có lỗi xảy ra khi tạo transcript!'
            });
        }
    },

    async handleStatus(interaction, client) {
        const embed = new EmbedBuilder()
            .setTitle('🤖 Trạng Thái Bot')
            .setColor('#00ff88')
            .addFields({ name: '📶 Ping', value: `${client.ws.ping}ms`, inline: true }, { name: '⏰ Uptime', value: `<t:${Math.floor((Date.now() - client.readyTimestamp) / 1000)}:R>`, inline: true }, { name: '🗃️ Guilds', value: client.guilds.cache.size.toString(), inline: true }, { name: '👥 Users', value: client.users.cache.size.toString(), inline: true }, { name: '💾 Memory', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, inline: true }, { name: '📊 Active Tickets', value: client.config.activeTickets.size.toString(), inline: true })
            .setFooter({ text: 'Ticket System v2.0' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async handleAddStaff(interaction, client) {
        const role = interaction.options.getRole('role');

        if (client.config.staffRoles.has(role.id)) {
            return interaction.reply({
                content: '❌ Role này đã được thêm vào danh sách staff!',
                ephemeral: true
            });
        }

        client.config.staffRoles.add(role.id);

        await interaction.reply({
            content: `✅ Đã thêm role ${role} vào danh sách staff!`,
            ephemeral: true
        });
    },

    async handleUserStaff(interaction, client) {
        const user = interaction.options.getUser('user');

        if (client.config.staffUsers.has(user.id)) {
            return interaction.reply({
                content: '❌ User này đã được thêm vào danh sách staff!',
                ephemeral: true
            });
        }

        client.config.staffUsers.add(user.id);

        await interaction.reply({
            content: `✅ Đã thêm ${user} vào danh sách staff!`,
            ephemeral: true
        });
    }
};