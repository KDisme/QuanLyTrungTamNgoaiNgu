const authService = require('../services/auth.service');

class AuthController {
  // POST /api/portal/find-tenant
  async portalFindTenant(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: 'Email is required' });

      const tenants = await authService.portalFindTenant(email);
      if (!tenants.length) return res.status(404).json({ message: 'No tenant found for this email' });

      res.json({ tenants });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/:tenantSlug/auth/login
  async login(req, res, next) {
    try {
      const { identifier, password } = req.body;
      if (!identifier || !password) {
        return res.status(400).json({ message: 'Email/phone and password are required' });
      }
      const result = await authService.login(req.tenant.id, identifier, password);
      res.json(result);
    } catch (err) {
      if (err.message === 'Invalid credentials') {
        return res.status(401).json({ message: 'Email/phone hoặc mật khẩu không đúng' });
      }
      next(err);
    }
  }

  // GET /api/:tenantSlug/auth/me
  async me(req, res) {
    res.json({ user: req.user });
  }
}

module.exports = new AuthController();
