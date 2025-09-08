// database/models.js - Database models using Sequelize
const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

// Database connection
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database/tickets.sqlite',
    logging: false, // Set to console.log to see SQL queries
    define: {
        timestamps: true,
        underscored: true
    }
});

// Guild Settings Model
const GuildSettings = sequelize.define('GuildSettings', {
    guild_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    prefix: {
        type: DataTypes.STRING,
        defaultValue: 't?'
    },
    staff_roles: {
        type: DataTypes.TEXT,
        defaultValue: '[]',
        get() {
            const value = this.getDataValue('staff_roles');
            return value ? JSON.parse(value) : [];
        },
        set(value) {
            this.setDataValue('staff_roles', JSON.stringify(value || []));
        }
    },
    staff_users: {
        type: DataTypes.TEXT,
        defaultValue: '[]',
        get() {
            const value = this.getDataValue('staff_users');
            return value ? JSON.parse(value) : [];
        },
        set(value) {
            this.setDataValue('staff_users', JSON.stringify(value || []));
        }
    },
    ticket_category: {
        type: DataTypes.STRING,
        allowNull: true
    },
    log_channel: {
        type: DataTypes.STRING,
        allowNull: true
    },
    ticket_counter: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    setup_channel: {
        type: DataTypes.STRING,
        allowNull: true
    }
});

// Ticket Model
const Ticket = sequelize.define('Ticket', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    ticket_id: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
    },
    guild_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    channel_id: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
    },
    user_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    claimed_by: {
        type: DataTypes.STRING,
        allowNull: true
    },
    claimed_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    closed_by: {
        type: DataTypes.STRING,
        allowNull: true
    },
    closed_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('open', 'claimed', 'closed'),
        defaultValue: 'open'
    },
    priority: {
        type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
        defaultValue: 'normal'
    },
    subject: {
        type: DataTypes.STRING,
        allowNull: true
    },
    transcript_id: {
        type: DataTypes.STRING,
        allowNull: true
    }
});

// Ticket Message Model (for storing transcript data)
const TicketMessage = sequelize.define('TicketMessage', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    ticket_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Ticket,
            key: 'id'
        }
    },
    message_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    author_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    author_username: {
        type: DataTypes.STRING,
        allowNull: false
    },
    author_discriminator: {
        type: DataTypes.STRING,
        allowNull: false
    },
    author_avatar: {
        type: DataTypes.STRING,
        allowNull: true
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    attachments: {
        type: DataTypes.TEXT,
        defaultValue: '[]',
        get() {
            const value = this.getDataValue('attachments');
            return value ? JSON.parse(value) : [];
        },
        set(value) {
            this.setDataValue('attachments', JSON.stringify(value || []));
        }
    },
    embeds: {
        type: DataTypes.TEXT,
        defaultValue: '[]',
        get() {
            const value = this.getDataValue('embeds');
            return value ? JSON.parse(value) : [];
        },
        set(value) {
            this.setDataValue('embeds', JSON.stringify(value || []));
        }
    },
    timestamp: {
        type: DataTypes.DATE,
        allowNull: false
    }
});

// Statistics Model
const TicketStats = sequelize.define('TicketStats', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    guild_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    tickets_created: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    tickets_closed: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    tickets_claimed: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    average_response_time: {
        type: DataTypes.INTEGER, // in minutes
        defaultValue: 0
    }
});

// Define associations
Ticket.hasMany(TicketMessage, {
    foreignKey: 'ticket_id',
    onDelete: 'CASCADE'
});
TicketMessage.belongsTo(Ticket, {
    foreignKey: 'ticket_id'
});

GuildSettings.hasMany(Ticket, {
    foreignKey: 'guild_id',
    sourceKey: 'guild_id',
    onDelete: 'CASCADE'
});

// Database manager class
class DatabaseManager {
    constructor() {
        this.sequelize = sequelize;
        this.models = {
            GuildSettings,
            Ticket,
            TicketMessage,
            TicketStats
        };
    }

    async initialize() {
        try {
            await sequelize.authenticate();
            console.log('✅ Database connection established successfully.');
            
            await sequelize.sync();
            console.log('✅ Database models synchronized.');
            
            return true;
        } catch (error) {
            console.error('❌ Unable to connect to database:', error);
            return false;
        }
    }

    async getGuildSettings(guildId) {
        try {
            let settings = await GuildSettings.findByPk(guildId);
            if (!settings) {
                settings = await GuildSettings.create({ guild_id: guildId });
            }
            return settings;
        } catch (error) {
            console.error('Error getting guild settings:', error);
            return null;
        }
    }

    async updateGuildSettings(guildId, updates) {
        try {
            const [settings, created] = await GuildSettings.findOrCreate({
                where: { guild_id: guildId },
                defaults: { guild_id: guildId, ...updates }
            });
            
            if (!created) {
                await settings.update(updates);
            }
            
            return settings;
        } catch (error) {
            console.error('Error updating guild settings:', error);
            return null;
        }
    }

    async createTicket(ticketData) {
        try {
            // Generate unique ticket ID
            const guildSettings = await this.getGuildSettings(ticketData.guild_id);
            const ticketNumber = (guildSettings.ticket_counter || 0) + 1;
            const ticketId = `#${ticketNumber.toString().padStart(6, '0')}`;
            
            const ticket = await Ticket.create({
                ...ticketData,
                ticket_id: ticketId
            });
            
            // Update counter
            await guildSettings.update({ ticket_counter: ticketNumber });
            
            return ticket;
        } catch (error) {
            console.error('Error creating ticket:', error);
            return null;
        }
    }

    async getTicket(channelId) {
        try {
            return await Ticket.findOne({
                where: { channel_id: channelId, status: { [Sequelize.Op.ne]: 'closed' } }
            });
        } catch (error) {
            console.error('Error getting ticket:', error);
            return null;
        }
    }

    async getActiveTickets(guildId = null) {
        try {
            const where = { status: { [Sequelize.Op.ne]: 'closed' } };
            if (guildId) where.guild_id = guildId;
            
            return await Ticket.findAll({ where });
        } catch (error) {
            console.error('Error getting active tickets:', error);
            return [];
        }
    }

    async updateTicket(channelId, updates) {
        try {
            const ticket = await Ticket.findOne({
                where: { channel_id: channelId }
            });
            
            if (ticket) {
                await ticket.update(updates);
                return ticket;
            }
            
            return null;
        } catch (error) {
            console.error('Error updating ticket:', error);
            return null;
        }
    }

    async closeTicket(channelId, closedBy) {
        try {
            const ticket = await Ticket.findOne({
                where: { channel_id: channelId }
            });
            
            if (ticket) {
                await ticket.update({
                    status: 'closed',
                    closed_by: closedBy,
                    closed_at: new Date()
                });
                return ticket;
            }
            
            return null;
        } catch (error) {
            console.error('Error closing ticket:', error);
            return null;
        }
    }

    async saveMessage(ticketId, messageData) {
        try {
            return await TicketMessage.create({
                ticket_id: ticketId,
                ...messageData
            });
        } catch (error) {
            console.error('Error saving message:', error);
            return null;
        }
    }

    async getTicketMessages(ticketId) {
        try {
            return await TicketMessage.findAll({
                where: { ticket_id: ticketId },
                order: [['timestamp', 'ASC']]
            });
        } catch (error) {
            console.error('Error getting ticket messages:', error);
            return [];
        }
    }

    async getTicketStats(guildId, days = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            
            const stats = await TicketStats.findAll({
                where: {
                    guild_id: guildId,
                    date: { [Sequelize.Op.gte]: startDate }
                },
                order: [['date', 'ASC']]
            });
            
            return stats;
        } catch (error) {
            console.error('Error getting ticket stats:', error);
            return [];
        }
    }

    async updateDailyStats(guildId, statsUpdate) {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            const [stats, created] = await TicketStats.findOrCreate({
                where: {
                    guild_id: guildId,
                    date: today
                },
                defaults: {
                    guild_id: guildId,
                    date: today,
                    ...statsUpdate
                }
            });
            
            if (!created) {
                const updates = {};
                Object.keys(statsUpdate).forEach(key => {
                    updates[key] = (stats[key] || 0) + statsUpdate[key];
                });
                await stats.update(updates);
            }
            
            return stats;
        } catch (error) {
            console.error('Error updating daily stats:', error);
            return null;
        }
    }

    async cleanup() {
        try {
            // Clean up old closed tickets (older than 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const deletedCount = await Ticket.destroy({
                where: {
                    status: 'closed',
                    closed_at: { [Sequelize.Op.lt]: thirtyDaysAgo }
                }
            });
            
            if (deletedCount > 0) {
                console.log(`🗑️ Cleaned up ${deletedCount} old tickets`);
            }
            
            return deletedCount;
        } catch (error) {
            console.error('Error during cleanup:', error);
            return 0;
        }
    }
}

module.exports = DatabaseManager;