/**
 * Middleware de verification des roles
 * Verifie si l'utilisateur a l'un des roles autorises
 * @param  {...string} allowedRoles - Liste des roles autorises
 */
const roleCheck = (...allowedRoles) => {
  return (req, res, next) => {
    // Verifier que l'utilisateur est authentifie
    if (!req.user) {
      return res.status(401).json({
        error: 'Non authentifie'
      });
    }

    // Verifier le role
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Acces refuse',
        message: `Role requis: ${allowedRoles.join(' ou ')}`
      });
    }

    next();
  };
};

module.exports = roleCheck;
