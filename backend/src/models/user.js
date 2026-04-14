// models/user.js
// Định nghĩa cấu trúc User (không chứa query)

class User {
  constructor({ id, name, email, password, password_changed_at }) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.password = password;
    this.password_changed_at = password_changed_at;
  }

  /**
   * Khi trả JSON ra API, tuyệt đối không expose password (dù đã hash).
   * Express `res.json()` sẽ dùng `JSON.stringify()` và tự gọi `toJSON()` nếu có.
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      password_changed_at: this.password_changed_at,
    };
  }
}

module.exports = User;
