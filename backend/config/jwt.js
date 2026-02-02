module.exports = {
  secret: process.env.JWT_SECRET || 'default_secret_change_in_production',
  expiresIn: process.env.JWT_EXPIRE || '24h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
};
