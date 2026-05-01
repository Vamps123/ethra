const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const dbPath = process.env.DATABASE_URL || path.join(__dirname, 'database.sqlite');
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false,
});

const User = sequelize.define('User', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('ADMIN', 'MEMBER'),
    defaultValue: 'MEMBER',
  },
});

const Project = sequelize.define('Project', {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
});

const ProjectMember = sequelize.define('ProjectMember', {
  role: {
    type: DataTypes.ENUM('OWNER', 'MEMBER'),
    defaultValue: 'MEMBER',
  },
});

const Task = sequelize.define('Task', {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  status: {
    type: DataTypes.ENUM('OPEN', 'IN_PROGRESS', 'DONE'),
    defaultValue: 'OPEN',
  },
  dueDate: {
    type: DataTypes.DATEONLY,
  },
});

User.belongsToMany(Project, { through: ProjectMember, as: 'projects' });
Project.belongsToMany(User, { through: ProjectMember, as: 'members' });
Project.belongsTo(User, { as: 'owner' });
Task.belongsTo(Project);
Task.belongsTo(User, { as: 'assignee' });
Project.hasMany(Task);
User.hasMany(Task, { foreignKey: 'assigneeId', as: 'assignedTasks' });

module.exports = {
  sequelize,
  User,
  Project,
  ProjectMember,
  Task,
};
