const multer = require("multer");

const storage = multer.memoryStorage();

module.exports = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});