const queryMethods = require('./query.service');
const crudMethods = require('./crud.service');
const submissionMethods = require('./submission.service');
const notifyMethods = require('./notify.service');

class HomeworkService {}

// Gộp tất cả method từ các file con vào prototype, để `this` trong mỗi method
// vẫn có thể gọi chéo sang method của file khác y như class gốc trước khi tách
// (vd: createAssignment gọi this.getAssignment / this._notifyStudentsAssigned...).
Object.assign(
  HomeworkService.prototype,
  queryMethods,
  crudMethods,
  submissionMethods,
  notifyMethods
);

module.exports = new HomeworkService();