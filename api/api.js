'use strict';

module.exports = {
    // Ưu tiên Met Museum API
    default: "met",
    
    // Các nguồn cung cấp dữ liệu
    met: require("./met"),
    artic: require("./artic"),
    local: require("./local")
};
