'use strict';

module.exports = {
    // Đổi default thành "met"
    default: "met",
    // Thêm dòng require file met.js vừa tạo
    met: require("./met"),
    artic: require("./artic"),
    local: require("./local")
};
