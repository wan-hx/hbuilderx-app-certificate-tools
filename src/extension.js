const hx = require("hbuilderx");

const androidCertificateCreate = require("./android/create.js");
const androidCertificateShow = require("./android/show.js");

//该方法将在插件激活的时候调用
function activate(context) {

    // 创建android证书
    let create = hx.commands.registerCommand('app-certificate-tools.androidCreate', () => {
        androidCertificateCreate();
    });
    context.subscriptions.push(create);

    // 查看android证书详情
    let show = hx.commands.registerCommand('app-certificate-tools.androidShow', () => {
        androidCertificateShow();
    });
    context.subscriptions.push(show);
};

function deactivate() {

};

module.exports = {
    activate,
    deactivate
}
