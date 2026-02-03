class Student {
  constructor(id, name, email, phone, address, enrollmentDate) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.phone = phone;
    this.address = address;
    this.enrollmentDate = enrollmentDate;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Chuyển đổi Student thành object JSON
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      phone: this.phone,
      address: this.address,
      enrollmentDate: this.enrollmentDate,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

module.exports = Student;
