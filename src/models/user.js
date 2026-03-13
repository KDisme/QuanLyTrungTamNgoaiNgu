class User {
  constructor({ id, name, email, password, password_changed_at }) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.password = password;
    this.password_changed_at = password_changed_at;
  }
}

module.exports = User;