const hx = require('hbuilderx');
const fs = require('fs');
const path = require('path');
const {
    runCmdForShow,
    getKeytool,
    getFileNameForDate,
    hxShowMessageBox,
    createOutputChannel
} = require('../utils.js');

// 上次输入信息
var LastKeystoreFile;

var formItems = [
    {type: "fileSelectInput",name: "keystoreFile",label: "证书位置",placeholder: 'keystore - 查看的证书路径', mode: 'file', value: ''},
    {type: "input",name: "storepass",label: "密钥库口令",placeholder: "您创建证书时设置的口令"},
    {type: "label",text: "备注：如果证书未设置过密码，请忽略。"},
];

/**
 * @description 验证用户填写数据
 * @param {Object} formData
 */
async function goValidate(formData, that) {
    let {keystoreFile, storepass} = formData;

    if (!fs.existsSync(keystoreFile)) {
        that.showError(`路径 ${keystoreFile} 不存在。`);
        return false;
    };
    if (storepass == ' ') {
        that.showError(`密码不能为空格`);
        return false;
    };
    return true;
};


/**
 * @description 查看android证书
 */
async function androidCertificateShow() {
    // 获取keytool路径，如果本地未安装，则采用HBuilderX内置的keytool
    let keytool = await getKeytool();
    if (keytool == "error") return;


    if (LastKeystoreFile && LastKeystoreFile.length) {
        formItems[0]['value'] = LastKeystoreFile;
    };

    let userInfo = await hx.window.showFormDialog({
        formItems: formItems,
        title: "Android证书查看详情",
        subtitle: "调用java keytool查看证书",
        width: 640,
        height: 290,
        submitButtonText: "确定(&S)",
        cancelButtonText: "取消(&C)",
        validate: function(formData) {
            let checkResult = goValidate(formData, this);
            return checkResult;
        }
    }).then((res) => {
        return res;
    }).catch(error => {
        console.log(error);
    })

    if (userInfo == undefined) return;

    let {keystoreFile,storepass} = userInfo;
    LastKeystoreFile = keystoreFile;

    let cmd = `keytool -list -v -keystore ${keystoreFile}`;
    if (storepass) {
        cmd = cmd + ` -storepass ${storepass}`;
    };

    let cmd_opts = {};

    if (keytool != 'keytool') {
        createOutputChannel("备注：当前操作，使用的是HBuilderX内置Java keytool工具。", "info");
        let keytoolDir = path.dirname(keytool);
        cmd_opts['cwd'] = keytoolDir;
    };

    // 控制台打印命令
    createOutputChannel(`运行的命令为：${cmd}`);

    runCmdForShow(cmd, cmd_opts);
};

module.exports = androidCertificateShow
