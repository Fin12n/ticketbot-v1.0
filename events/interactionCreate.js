// events/interactionCreate.js - Handle button interactions and slash commands
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            const command = client.slashCommands.get(interaction.commandName);

            if (!command) return;

            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.error('Slash command error:', error);
                const reply = { content: '❌ Có lỗi xảy ra khi thực hiện lệnh!', ephemeral: true };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(reply);
                } else {
                    await interaction.reply(reply);
                }
            }
        }

        // Handle button interactions
        if (interaction.isButton()) {
            switch (interaction.customId) {
                case 'create_ticket':
                    await handleCreateTicket(interaction, client);
                    break;
                case 'claim_ticket':
                    await handleClaimTicket(interaction, client);
                    break;
                case 'close_ticket':
                    await handleCloseTicket(interaction, client);
                    break;
                case 'transcript_ticket':
                    await handleTranscriptTicket(interaction, client);
                    break;
                case 'confirm_close':
                    await handleConfirmClose(interaction, client);
                    break;
                case 'cancel_close':
                    await handleCancelClose(interaction, client);
                    break;
            }
        }
    },
};

async function handleCreateTicket(interaction, client) {
    // Check if user already has an open ticket
    const existingTicket = await client.db.models.Ticket.findOne({
        where: { 
            user_id: interaction.user.id,
            guild_id: interaction.guild.id,
            status: ['open', 'claimed']
        }
    });

    if (existingTicket) {
        return interaction.reply({
            content: `❌ Bạn đã có một ticket mở tại <#${existingTicket.channel_id}>!`,
            ephemeral: true
        });
    }

    try {
        await interaction.deferReply({ ephemeral: true });

        // Find or create category
        let category = interaction.guild.channels.cache.find(
            c => c.name.toLowerCase() === 'tickets' && c.type === 4
        );

        if (!category) {
            category = await interaction.guild.channels.create({
                name: 'Tickets',
                type: 4, // Category
            });
        }

        // Create ticket channel
        const ticketChannel = await client.utils.createTicketChannel(
            interaction.guild,
            interaction.user,
            category.id
        );

        // Create ticket in database
        const ticket = await client.db.createTicket({
            guild_id: interaction.guild.id,
            channel_id: ticketChannel.id,
            user_id: interaction.user.id,
            status: 'open'
        });

        if (!ticket) {
            throw new Error('Failed to create ticket in database');
        }

        // Update stats
        await client.utils.updateGuildStats(interaction.guild.id, { tickets_created: 1 });

        // Send welcome message in ticket
        const welcomeEmbed = client.utils.createTicketEmbed('created', {
            user: interaction.user,
            ticketId: ticket.ticket_id
        });

        const controlButtons = client.utils.createButtons('ticket_controls');

        await ticketChannel.send({
            content: `${interaction.user}`,
            embeds: [welcomeEmbed],
            components: [controlButtons]
        });

        await interaction.editReply({
            content: `✅ Ticket của bạn đã được tạo tại ${ticketChannel}!`
        });

    } catch (error) {
        console.error('Create ticket error:', error);
        await interaction.editReply({
            content: '❌ Có lỗi xảy ra khi tạo ticket!'
        });
    }
}

async function handleClaimTicket(interaction, client) {
    if (!(await client.utils.isStaff(interaction.member))) {
        return interaction.reply({
            content: '❌ Chỉ staff mới có thể claim ticket!',
            ephemeral: true
        });
    }

    const channel = interaction.channel;
    const ticket = await client.db.getTicket(channel.id);

    if (!ticket) {
        return interaction.reply({
            content: '❌ Không tìm thấy dữ liệu ticket!',
            ephemeral: true
        });
    }

    if (ticket.claimed_by) {
        const claimedUser = await client.users.fetch(ticket.claimed_by);
        return interaction.reply({
            content: `❌ Ticket này đã được claim bởi ${claimedUser.username}!`,
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

    // Add staff to channel permissions if not already added
    await channel.permissionOverwrites.edit(interaction.user, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        ManageMessages: true
    });
}

async function handleCloseTicket(interaction, client) {
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
}

async function handleTranscriptTicket(interaction, client) {
    if (!(await client.utils.isStaff(interaction.member))) {
        return interaction.reply({
            content: '❌ Chỉ staff mới có thể lấy transcript!',
            ephemeral: true
        });
    }

    try {
        await interaction.deferReply({ ephemeral: true });

        const transcriptId = await client.utils.generateTranscript(interaction.channel);
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
}

async function handleConfirmClose(interaction, client) {
    const channel = interaction.channel;
    const ticket = await client.db.getTicket(channel.id);

    if (!ticket) {
        return interaction.reply({
            content: '❌ Không tìm thấy dữ liệu ticket!',
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

        // Send transcript to ticket creator if possible
        try {
            const user = await client.users.fetch(ticket.user_id);
            const transcriptUrl = `${process.env.WEBSITE_URL || 'http://localhost:3000'}/transcript/${transcriptId}`;

            const embed = new EmbedBuilder()
                .setTitle('📄 Transcript Ticket')
                .setDescription(`Ticket của bạn đã được đóng. Đây là transcript:`)
                .addFields(
                    { name: '🆔 Ticket ID', value: ticket.ticket_id, inline: true },
                    { name: '🔗 Link Transcript', value: `[Xem Transcript](${transcriptUrl})`, inline: true }
                )
                .setColor('#4ecdc4')
                .setFooter({ text: 'Ticket System v2.0' })
                .setTimestamp();

            await user.send({ embeds: [embed] }).catch(() => {});
        } catch (error) {
            console.log('Could not send transcript to user:', error);
        }

        await interaction.reply('🔒 Ticket sẽ bị đóng trong 5 giây...');

        setTimeout(async () => {
            try {
                await channel.delete();
            } catch (error) {
                console.error('Error deleting channel:', error);
            }
        }, 5000);

    } catch (error) {
        console.error('Close ticket error:', error);
        await interaction.reply({
            content: '❌ Có lỗi xảy ra khi đóng ticket!',
            ephemeral: true
        });
    }
}

async function handleCancelClose(interaction, client) {
    await interaction.update({
        content: '❌ Hủy đóng ticket.',
        embeds: [],
        components: []
    });
}