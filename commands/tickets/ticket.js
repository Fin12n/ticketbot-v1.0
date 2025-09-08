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
        if (subcommand !== 'close' && !(await client.utils.isStaff(member)) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
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

            // Save setup channel to database
            await client.db.updateGuildSettings(interaction.guild.id, {
                setup_channel: channel.id
            });

            await interaction.reply({
                content: `✅ Đã thiết lập hệ thống ticket trong ${channel}`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Setup error:', error);
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

            // Close ticket in database
            await client.db.closeTicket(channel.id, interaction.user.id);

            // Update stats
            await client.utils.updateGuildStats(interaction.guild.id, { tickets_closed: 1 });

            await interaction.reply('🔒 Ticket sẽ bị đóng trong 5 giây...');

            setTimeout(async () => {
                try {
                    await channel.delete();
                } catch (error) {
                    console.error('Error deleting channel:', error);
                }
            }, 5000);

        } catch (error) {
            console.error('Force close error:', error);
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
        const stats = await client.utils.getGuildStats(interaction.guild.id);

        const embed = new EmbedBuilder()
            .setTitle('📊 Thống Kê Tickets')
            .setColor('#4ecdc4')
            .addFields(
                { name: '📝 Tổng Tickets', value: stats.total.toString(), inline: true },
                { name: '🔓 Đang Mở', value: stats.open.toString(), inline: true },
                { name: '🔒 Đã Đóng', value: stats.closed.toString(), inline: true },
                { name: '🛡️ Đã Claim', value: stats.claimed.toString(), inline: true },
                { name: '⏰ Uptime', value: `<t:${Math.floor((Date.now() - client.readyTimestamp) / 1000)}:R>`, inline: true },
                { name: '🤖 Bot Status', value: '🟢 Online', inline: true }
            )
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

        const ticket = await client.db.getTicket(channel.id);
        if (!ticket) {
            return interaction.reply({
                content: '❌ Không tìm thấy dữ liệu ticket!',
                ephemeral: true
            });
        }

        if (ticket.claimed_by) {
            return interaction.reply({
                content: '❌ Ticket này đã được claim!',
                ephemeral: true
            });
        }

        // Update ticket data
        await client.db.updateTicket(channel.id, {
            claimed_by: interaction.user.id,
            claimed_at: new Date(),
            status: 'claimed'
        });

        // Update stats
        await client.utils.updateGuildStats(interaction.guild.id, { tickets_claimed: 1 });

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
            const transcriptUrl = `${process.env.WEBSITE_URL || 'http://localhost:3000'}/transcript/${transcriptId}`;

            await interaction.editReply({
                content: `📄 **Transcript đã được tạo!**\n🔗 Link: ${transcriptUrl}`
            });
        } catch (error) {
            console.error('Transcript error:', error);
            await interaction.editReply({
                content: '❌ Có lỗi xảy ra khi tạo transcript!'
            });
        }
    },

    async handleStatus(interaction, client) {
        const stats = await client.utils.getGuildStats(interaction.guild.id);
        
        const embed = new EmbedBuilder()
            .setTitle('🤖 Trạng Thái Bot')
            .setColor('#00ff88')
            .addFields(
                { name: '📶 Ping', value: `${client.ws.ping}ms`, inline: true },
                { name: '⏰ Uptime', value: `<t:${Math.floor((Date.now() - client.readyTimestamp) / 1000)}:R>`, inline: true },
                { name: '🗃️ Guilds', value: client.guilds.cache.size.toString(), inline: true },
                { name: '👥 Users', value: client.users.cache.size.toString(), inline: true },
                { name: '💾 Memory', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, inline: true },
                { name: '📊 Active Tickets', value: stats.open.toString(), inline: true }
            )
            .setFooter({ text: 'Ticket System v2.0' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async handleAddStaff(interaction, client) {
        const role = interaction.options.getRole('role');

        try {
            const guildSettings = await client.db.getGuildSettings(interaction.guild.id);
            const staffRoles = guildSettings.staff_roles || [];
            
            if (staffRoles.includes(role.id)) {
                return interaction.reply({
                    content: '❌ Role này đã được thêm vào danh sách staff!',
                    ephemeral: true
                });
            }

            staffRoles.push(role.id);
            await client.db.updateGuildSettings(interaction.guild.id, {
                staff_roles: staffRoles
            });

            await interaction.reply({
                content: `✅ Đã thêm role ${role} vào danh sách staff!`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Add staff role error:', error);
            await interaction.reply({
                content: '❌ Có lỗi xảy ra khi thêm staff role!',
                ephemeral: true
            });
        }
    },

    async handleUserStaff(interaction, client) {
        const user = interaction.options.getUser('user');

        try {
            const guildSettings = await client.db.getGuildSettings(interaction.guild.id);
            const staffUsers = guildSettings.staff_users || [];
            
            if (staffUsers.includes(user.id)) {
                return interaction.reply({
                    content: '❌ User này đã được thêm vào danh sách staff!',
                    ephemeral: true
                });
            }

            staffUsers.push(user.id);
            await client.db.updateGuildSettings(interaction.guild.id, {
                staff_users: staffUsers
            });

            await interaction.reply({
                content: `✅ Đã thêm ${user} vào danh sách staff!`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Add staff user error:', error);
            await interaction.reply({
                content: '❌ Có lỗi xảy ra khi thêm staff user!',
                ephemeral: true
            });
        }
    }
};